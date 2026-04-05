import {
  ENTITY_STORE_NAMES,
  type EntityKind,
  isOnline,
  listQueuedMutations,
  moveRecordId,
  notifyDataChanged,
  remapEntityReferences,
  replaceQueuedMutations,
  resolveMappedId,
  setIdMapping,
  type QueuedMutation,
} from './offlinePersistence';

const meta = import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } };
const BASE = meta.env?.VITE_API_BASE ? String(meta.env.VITE_API_BASE).replace(/\/$/, '') : '';

let syncInFlight: Promise<void> | null = null;
let listenersRegistered = false;
let retryTimerId: number | null = null;

const ONLINE_RETRY_INTERVAL_MS = 5000;

class SyncHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'SyncHttpError';
  }
}

function buildUrl(path: string): string {
  return `${BASE}${path}`;
}

function normalizeServerId(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  // API can return JSON string values like "guid"; convert to plain guid.
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return parsed;
    }
  } catch {
    // Not JSON, use raw value.
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

async function parseError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function sendMutation(mutation: QueuedMutation): Promise<string | undefined> {
  const payload = await translatePayload(mutation);

  if (mutation.action === 'create') {
    const response = await fetch(buildUrl(getCreatePath(mutation.entity)), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new SyncHttpError(response.status, `${response.status} ${await parseError(response)}`);
    }

    const text = await response.text();
    return normalizeServerId(text);
  }

  if (mutation.action === 'update') {
    const response = await fetch(buildUrl(`${getEntityPath(mutation.entity)}/${await resolveMappedId(mutation.targetId)}`), {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new SyncHttpError(response.status, `${response.status} ${await parseError(response)}`);
    }

    const text = await response.text();
    return normalizeServerId(text);
  }

  const response = await fetch(buildUrl(`${getEntityPath(mutation.entity)}/${await resolveMappedId(mutation.targetId)}`), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new SyncHttpError(response.status, `${response.status} ${await parseError(response)}`);
  }

  const text = await response.text();
  return normalizeServerId(text);
}

async function translatePayload(mutation: QueuedMutation): Promise<unknown> {
  const payload = mutation.payload;
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const nextPayload = { ...(payload as Record<string, unknown>) };

  if (mutation.entity === 'fuelRequest') {
    const stationId = nextPayload['stationId'];
    if (typeof stationId === 'string') {
      nextPayload['stationId'] = await resolveMappedId(stationId);
    }
    return nextPayload;
  }

  if (mutation.entity === 'delivery') {
    const requestId = nextPayload['requestId'];
    const storageId = nextPayload['storageId'];
    if (typeof requestId === 'string') {
      nextPayload['requestId'] = await resolveMappedId(requestId);
    }
    if (typeof storageId === 'string') {
      nextPayload['storageId'] = await resolveMappedId(storageId);
    }
    return nextPayload;
  }

  return nextPayload;
}

function getEntityPath(entity: EntityKind): string {
  if (entity === 'station') return '/api/Station';
  if (entity === 'storage') return '/api/Storage';
  if (entity === 'fuelRequest') return '/api/FuelRequest';
  return '/api/Delivery';
}

function getCreatePath(entity: EntityKind): string {
  return getEntityPath(entity);
}

async function applySuccessfulCreate(mutation: QueuedMutation, serverId: string | undefined): Promise<void> {
  if (!serverId || serverId === mutation.targetId) {
    return;
  }

  await setIdMapping({
    offlineId: mutation.targetId,
    serverId,
    entity: mutation.entity,
  });

  const storeName = ENTITY_STORE_NAMES[mutation.entity];
  const payload = mutation.payload as Record<string, unknown> | undefined;
  if (payload && typeof payload === 'object') {
    await moveRecordId<Record<string, unknown> & { id: string }>(storeName, mutation.targetId, {
      ...(payload as Record<string, unknown>),
      id: serverId,
    });
  }

  await remapEntityReferences(mutation.entity, mutation.targetId, serverId);
}

async function applySuccessfulMutation(mutation: QueuedMutation, serverId: string | undefined): Promise<void> {
  if (mutation.action !== 'create') {
    return;
  }

  await applySuccessfulCreate(mutation, serverId);
}

export async function flushQueuedMutations(): Promise<void> {
  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = (async () => {
    if (!isOnline()) {
      return;
    }

    const queuedMutations = await listQueuedMutations();
    if (queuedMutations.length === 0) {
      return;
    }

    const remainingMutations: QueuedMutation[] = [];
    let changed = false;

    for (let index = 0; index < queuedMutations.length; index += 1) {
      const mutation = queuedMutations[index];

      try {
        const remoteId = await sendMutation(mutation);
        await applySuccessfulMutation(mutation, remoteId);
        changed = true;
      } catch (error) {
        if (
          error instanceof SyncHttpError
          && error.status === 404
          && (mutation.action === 'update' || mutation.action === 'delete')
        ) {
          // Treat missing remote record as terminal for this mutation and continue.
          changed = true;
          continue;
        }

        remainingMutations.push(...queuedMutations.slice(index));
        break;
      }
    }

    if (changed) {
      await replaceQueuedMutations(remainingMutations);
      notifyDataChanged();
    }
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

export function scheduleOfflineSync(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!listenersRegistered) {
    listenersRegistered = true;
    window.addEventListener('online', () => {
      void flushQueuedMutations();
    });

    retryTimerId = window.setInterval(() => {
      if (!isOnline()) {
        return;
      }

      void flushQueuedMutations();
    }, ONLINE_RETRY_INTERVAL_MS);
  }

  if (isOnline()) {
    void flushQueuedMutations();
  }
}

scheduleOfflineSync();
