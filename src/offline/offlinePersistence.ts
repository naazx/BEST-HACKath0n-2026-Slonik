export const ENTITY_STORE_NAMES = {
  station: 'stations',
  storage: 'storages',
  fuelRequest: 'fuelRequests',
  delivery: 'deliveries',
} as const;

export type EntityKind = keyof typeof ENTITY_STORE_NAMES;
export type MutationAction = 'create' | 'update' | 'delete';

export interface QueuedMutation {
  id: string;
  entity: EntityKind;
  action: MutationAction;
  targetId: string;
  payload: unknown;
  createdAt: string;
}

export interface IdMapping {
  offlineId: string;
  serverId: string;
  entity: EntityKind;
}

const DB_NAME = 'fulogi-offline-db';
const DB_VERSION = 1;
const MUTATION_QUEUE_STORE = 'mutationQueue';
const ID_MAP_STORE = 'idMappings';
const ENTITY_STORES = Object.values(ENTITY_STORE_NAMES);

let dbPromise: Promise<IDBDatabase> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        for (const storeName of ENTITY_STORES) {
          if (!database.objectStoreNames.contains(storeName)) {
            database.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
        if (!database.objectStoreNames.contains(MUTATION_QUEUE_STORE)) {
          database.createObjectStore(MUTATION_QUEUE_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(ID_MAP_STORE)) {
          database.createObjectStore(ID_MAP_STORE, { keyPath: 'offlineId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
    });
  }

  return dbPromise;
}

async function requestFromStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = executor(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`IndexedDB request failed for ${storeName}.`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`IndexedDB transaction aborted for ${storeName}.`));
  });
}

async function transactionComplete(storeName: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => void): Promise<void> {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`IndexedDB transaction failed for ${storeName}.`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`IndexedDB transaction aborted for ${storeName}.`));

    try {
      work(store);
    } catch (error) {
      reject(error);
      transaction.abort();
    }
  });
}

export function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function readAllRecords<T>(storeName: string): Promise<T[]> {
  try {
    const result = await requestFromStore<T[]>(storeName, 'readonly', store => store.getAll());
    return result ?? [];
  } catch {
    return [];
  }
}

export async function readRecord<T>(storeName: string, id: string): Promise<T | null> {
  try {
    const result = await requestFromStore<T | undefined>(storeName, 'readonly', store => store.get(id));
    return result ?? null;
  } catch {
    return null;
  }
}

export async function replaceAllRecords<T extends { id: string }>(storeName: string, records: T[]): Promise<void> {
  await transactionComplete(storeName, 'readwrite', store => {
    store.clear();
    for (const record of records) {
      store.put(record);
    }
  });
}

export async function upsertRecord<T extends { id: string }>(storeName: string, record: T): Promise<void> {
  await transactionComplete(storeName, 'readwrite', store => {
    store.put(record);
  });
}

export async function deleteRecord(storeName: string, id: string): Promise<void> {
  await transactionComplete(storeName, 'readwrite', store => {
    store.delete(id);
  });
}

export async function moveRecordId<T extends { id: string }>(storeName: string, oldId: string, newRecord: T): Promise<void> {
  await transactionComplete(storeName, 'readwrite', store => {
    store.delete(oldId);
    store.put(newRecord);
  });
}

export async function queueMutation(mutation: QueuedMutation): Promise<void> {
  await transactionComplete(MUTATION_QUEUE_STORE, 'readwrite', store => {
    store.put(mutation);
  });
}

export async function listQueuedMutations(): Promise<QueuedMutation[]> {
  try {
    const result = await requestFromStore<QueuedMutation[]>(MUTATION_QUEUE_STORE, 'readonly', store => store.getAll());
    return (result ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

export async function replaceQueuedMutations(mutations: QueuedMutation[]): Promise<void> {
  await transactionComplete(MUTATION_QUEUE_STORE, 'readwrite', store => {
    store.clear();
    for (const mutation of mutations) {
      store.put(mutation);
    }
  });
}

export async function setIdMapping(mapping: IdMapping): Promise<void> {
  await transactionComplete(ID_MAP_STORE, 'readwrite', store => {
    store.put(mapping);
  });
}

export async function getIdMapping(offlineId: string): Promise<IdMapping | null> {
  try {
    const result = await requestFromStore<IdMapping | undefined>(ID_MAP_STORE, 'readonly', store => store.get(offlineId));
    return result ?? null;
  } catch {
    return null;
  }
}

function normalizeMappedId(id: string): string {
  const trimmed = id.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export async function resolveMappedId(id: string): Promise<string> {
  const mapping = await getIdMapping(id);
  if (!mapping) {
    return id;
  }

  const normalizedServerId = normalizeMappedId(mapping.serverId);

  // Self-heal old mappings saved with quoted IDs.
  if (normalizedServerId !== mapping.serverId) {
    await setIdMapping({
      ...mapping,
      serverId: normalizedServerId,
    });
  }

  return normalizedServerId;
}

async function updateForeignKey(storeName: string, fieldName: string, oldId: string, newId: string): Promise<void> {
  const records = await readAllRecords<Record<string, unknown> & { id: string }>(storeName);
  let changed = false;
  const nextRecords = records.map(record => {
    if (record[fieldName] !== oldId) {
      return record;
    }

    changed = true;
    return {
      ...record,
      [fieldName]: newId,
    };
  });

  if (changed) {
    await replaceAllRecords(storeName, nextRecords);
  }
}

export async function remapEntityReferences(entity: EntityKind, oldId: string, newId: string): Promise<void> {
  if (oldId === newId) {
    return;
  }

  if (entity === 'station') {
    await updateForeignKey(ENTITY_STORE_NAMES.fuelRequest, 'stationId', oldId, newId);
    return;
  }

  if (entity === 'storage') {
    await updateForeignKey(ENTITY_STORE_NAMES.fuelRequest, 'storageId', oldId, newId);
    await updateForeignKey(ENTITY_STORE_NAMES.delivery, 'storageId', oldId, newId);
    return;
  }

  if (entity === 'fuelRequest') {
    await updateForeignKey(ENTITY_STORE_NAMES.delivery, 'requestId', oldId, newId);
    return;
  }

  if (entity === 'delivery') {
    await updateForeignKey(ENTITY_STORE_NAMES.fuelRequest, 'deliveryId', oldId, newId);
  }
}

export function notifyDataChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event('fulogi:data-changed'));
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : false;
}
