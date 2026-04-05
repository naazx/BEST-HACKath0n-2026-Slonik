import {
  ENTITY_STORE_NAMES,
  createLocalId,
  deleteRecord,
  isOnline,
  listQueuedMutations,
  notifyDataChanged,
  queueMutation,
  readAllRecords,
  readRecord,
  replaceQueuedMutations,
  replaceAllRecords,
  resolveMappedId,
  upsertRecord,
  type EntityKind,
} from '../offline/offlinePersistence';
import { flushQueuedMutations, scheduleOfflineSync } from '../offline/offlineSync';

const meta = import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } };
const BASE = meta.env?.VITE_API_BASE ? String(meta.env.VITE_API_BASE).replace(/\/$/, '') : '';
const NETWORK_FAILURE_COOLDOWN_MS = 5000;
let preferCacheUntil = 0;
let syncBeforeReadInFlight: Promise<void> | null = null;

function shouldUseRemote(): boolean {
  return isOnline() && Date.now() >= preferCacheUntil;
}

function markNetworkFailureCooldown(): void {
  preferCacheUntil = Date.now() + NETWORK_FAILURE_COOLDOWN_MS;
}

function clearNetworkFailureCooldown(): void {
  preferCacheUntil = 0;
}

async function ensureSyncedBeforeRemoteRead(): Promise<void> {
  if (!isOnline()) {
    return;
  }

  if (syncBeforeReadInFlight) {
    return syncBeforeReadInFlight;
  }

  syncBeforeReadInFlight = flushQueuedMutations()
    .catch(() => {
      // Keep cached data if sync fails.
    })
    .finally(() => {
      syncBeforeReadInFlight = null;
    });

  return syncBeforeReadInFlight;
}

async function canUseRemoteRead(): Promise<boolean> {
  if (!shouldUseRemote()) {
    return false;
  }

  await ensureSyncedBeforeRemoteRead();

  if (!shouldUseRemote()) {
    return false;
  }

  const pendingMutations = await listQueuedMutations();
  return pendingMutations.length === 0;
}

export const FUEL_TYPES = ['A95', 'A92', 'Diesel', 'LPG'] as const;

export type FuelType = (typeof FUEL_TYPES)[number];
export type UiPriority = 'high' | 'medium' | 'low';
export type UiRequestStatus = 'pending' | 'in_process' | 'delivered';

export interface FuelItemDto {
  id?: string;
  fuelType: FuelType;
  amount: number;
}

export interface StationDto {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface StorageDto {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  fuelItems: FuelItemDto[];
}

export interface FuelRequestDto {
  id: string;
  stationId: string;
  stationName: string;
  storageId: string | null;
  storageName: string | null;
  deliveryId: string | null;
  items: FuelItemDto[];
  priority: unknown;
  status: unknown;
  createdAt: string;
  distanceKm: number | null;
}

export interface DeliveryDto {
  id: string;
  requestId: string;
  storageId: string;
  deliveredAmount: number;
  status: unknown;
  createdAt: string;
}

export interface UrgentFuelRequestDto {
  id: string;
}

export interface StorageUpsertBody {
  name: string;
  latitude: number;
  longitude: number;
  fuelItems: FuelItemDto[];
}

export interface FuelRequestUpsertBody {
  stationId: string;
  priority: number;
  status: number;
  createdAt: string;
  items: Array<Pick<FuelItemDto, 'fuelType' | 'amount'>>;
}

export interface DeliveryUpsertBody {
  requestId: string;
  storageId: string;
  deliveredAmount: number;
  status: 'Await' | 'InProgress' | 'Done';
  createdAt: string;
}

function getStoreName(entity: EntityKind): string {
  return ENTITY_STORE_NAMES[entity];
}

async function parseError(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...init?.headers,
  };
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
    clearNetworkFailureCooldown();
  } catch (error) {
    markNetworkFailureCooldown();
    throw error;
  }

  if (!res.ok) {
    throw new Error(`${res.status} ${await parseError(res)}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export function coerceFuelType(value: unknown): FuelType {
  if (value === 1 || value === '1' || value === 'A95' || value === 'a95') return 'A95';
  if (value === 2 || value === '2' || value === 'A92' || value === 'a92') return 'A92';
  if (value === 3 || value === '3' || value === 'Diesel' || value === 'diesel') return 'Diesel';
  if (value === 4 || value === '4' || value === 'LPG' || value === 'lpg') return 'LPG';
  return 'A95';
}

function normalizeFuelItems(items: FuelItemDto[] | undefined): FuelItemDto[] {
  const totals = new Map<FuelType, number>();

  for (const item of items ?? []) {
    const fuelType = coerceFuelType(item.fuelType);
    const amount = Number(item.amount) || 0;
    if (amount <= 0) {
      continue;
    }

    totals.set(fuelType, (totals.get(fuelType) ?? 0) + amount);
  }

  return FUEL_TYPES.flatMap(fuelType => {
    const amount = totals.get(fuelType) ?? 0;
    return amount > 0 ? [{ fuelType, amount }] : [];
  });
}

export function dtoPriorityToUi(value: unknown): UiPriority {
  if (value === 1 || value === 'low' || value === 'Low') return 'low';
  if (value === 2 || value === 'medium' || value === 'Medium') return 'medium';
  if (value === 3 || value === 'high' || value === 'High') return 'high';
  return 'medium';
}

export function uiPriorityToApi(priority: UiPriority): number {
  return priority === 'low' ? 1 : priority === 'medium' ? 2 : 3;
}

export function dtoStatusToUi(value: unknown): UiRequestStatus {
  if (
    value === 1 ||
    value === 'await' ||
    value === 'Await' ||
    value === 'pending' ||
    value === 'Pending'
  ) {
    return 'pending';
  }
  if (
    value === 2 ||
    value === 'inProgress' ||
    value === 'InProgress' ||
    value === 'in_process' ||
    value === 'In_Process'
  ) {
    return 'in_process';
  }
  if (value === 3 || value === 'done' || value === 'Done' || value === 'delivered') {
    return 'delivered';
  }
  return 'pending';
}

export function uiStatusToApi(status: UiRequestStatus): number {
  if (status === 'pending') return 1;
  if (status === 'in_process') return 2;
  return 3;
}

function buildStationRecord(id: string, body: { name: string; latitude: number; longitude: number }): StationDto {
  return { id, ...body };
}

function buildStorageRecord(
  id: string,
  body: StorageUpsertBody,
): StorageDto {
  return {
    id,
    name: body.name,
    latitude: body.latitude,
    longitude: body.longitude,
    fuelItems: normalizeFuelItems(body.fuelItems),
  };
}

async function cacheStations(stations: StationDto[]): Promise<void> {
  await replaceAllRecords(ENTITY_STORE_NAMES.station, stations);
}

async function cacheStorages(storages: StorageDto[]): Promise<void> {
  await replaceAllRecords(ENTITY_STORE_NAMES.storage, storages.map(storage => ({
    ...storage,
    fuelItems: normalizeFuelItems(storage.fuelItems),
  })));
}

async function cacheFuelRequests(fuelRequests: FuelRequestDto[]): Promise<void> {
  await replaceAllRecords(ENTITY_STORE_NAMES.fuelRequest, fuelRequests.map(request => ({
    ...request,
    items: normalizeFuelItems(request.items),
  })));
}

async function cacheDeliveries(deliveries: DeliveryDto[]): Promise<void> {
  await replaceAllRecords(ENTITY_STORE_NAMES.delivery, deliveries);
}

async function fetchStationsRemote(): Promise<StationDto[]> {
  return apiJson<StationDto[]>('/api/Station');
}

async function fetchStoragesRemote(): Promise<StorageDto[]> {
  return apiJson<StorageDto[]>('/api/Storage');
}

async function fetchFuelRequestsRemote(): Promise<FuelRequestDto[]> {
  return apiJson<FuelRequestDto[]>('/api/FuelRequest/sorted-by-priority-and-status');
}

async function fetchDeliveriesRemote(): Promise<DeliveryDto[]> {
  return apiJson<DeliveryDto[]>('/api/Delivery');
}

function stationFromCache(stations: StationDto[], id: string): StationDto | undefined {
  return stations.find(station => station.id === id);
}

async function getCachedStationName(stationId: string): Promise<string> {
  const stations = await readAllRecords<StationDto>(ENTITY_STORE_NAMES.station);
  return stationFromCache(stations, stationId)?.name ?? 'Unknown station';
}

async function getCachedStorageName(storageId: string): Promise<string> {
  const storages = await readAllRecords<StorageDto>(ENTITY_STORE_NAMES.storage);
  return storages.find(storage => storage.id === storageId)?.name ?? 'Unknown storage';
}

async function createOptimisticStation(body: { name: string; latitude: number; longitude: number }): Promise<StationDto> {
  const record = buildStationRecord(createLocalId(), body);
  await upsertRecord(ENTITY_STORE_NAMES.station, record);
  notifyDataChanged();
  return record;
}

async function createOptimisticStorage(body: {
  name: string;
  latitude: number;
  longitude: number;
  fuelItems: FuelItemDto[];
}): Promise<StorageDto> {
  const record = buildStorageRecord(createLocalId(), body);
  await upsertRecord(ENTITY_STORE_NAMES.storage, record);
  notifyDataChanged();
  return record;
}

async function createOptimisticFuelRequest(body: {
  stationId: string;
  priority: number;
  status: number;
  createdAt: string;
  items: Array<Pick<FuelItemDto, 'fuelType' | 'amount'>>;
}): Promise<FuelRequestDto> {
  const stations = await readAllRecords<StationDto>(ENTITY_STORE_NAMES.station);
  const stationName = stationFromCache(stations, body.stationId)?.name ?? 'Unknown station';
  const record: FuelRequestDto = {
    id: createLocalId(),
    stationId: body.stationId,
    stationName,
    storageId: null,
    storageName: null,
    deliveryId: null,
    items: normalizeFuelItems(body.items),
    priority: body.priority,
    status: body.status,
    createdAt: body.createdAt,
    distanceKm: null,
  };
  await upsertRecord(ENTITY_STORE_NAMES.fuelRequest, record);
  notifyDataChanged();
  return record;
}

async function createOptimisticDelivery(body: {
  requestId: string;
  storageId: string;
  deliveredAmount: number;
  status: 'Await' | 'InProgress' | 'Done';
  createdAt: string;
}): Promise<DeliveryDto> {
  const record: DeliveryDto = {
    id: createLocalId(),
    requestId: body.requestId,
    storageId: body.storageId,
    deliveredAmount: body.deliveredAmount,
    status: body.status,
    createdAt: body.createdAt,
  };
  await upsertRecord(ENTITY_STORE_NAMES.delivery, record);

  const requests = await readAllRecords<FuelRequestDto>(ENTITY_STORE_NAMES.fuelRequest);
  const storageName = await getCachedStorageName(body.storageId);
  const nextRequests = requests.map(request =>
    request.id === body.requestId
      ? { ...request, deliveryId: record.id, storageId: body.storageId, storageName }
      : request,
  );
  await cacheFuelRequests(nextRequests);
  notifyDataChanged();
  return record;
}

async function handleCreateMutation<TBody, TRecord extends { id: string }>(options: {
  entity: EntityKind;
  body: TBody;
  remotePath: string;
  buildRecord: (id: string, body: TBody) => TRecord | Promise<TRecord>;
  optimisticCreate: (body: TBody) => Promise<TRecord>;
}): Promise<string> {
  await flushQueuedMutations();

  if (shouldUseRemote()) {
    try {
      const remote = await apiJson<string>(options.remotePath, {
        method: 'POST',
        body: JSON.stringify(options.body),
      });
      const record = await options.buildRecord(remote, options.body);
      await upsertRecord(getStoreName(options.entity), record);
      notifyDataChanged();
      return remote;
    } catch {
      // Fall through to queueing below.
    }
  }

  const optimisticRecord = await options.optimisticCreate(options.body);
  await queueMutation({
    id: createLocalId(),
    entity: options.entity,
    action: 'create',
    targetId: optimisticRecord.id,
    payload: options.body,
    createdAt: new Date().toISOString(),
  });
  return optimisticRecord.id;
}

async function handleUpdateMutation<TBody, TRecord extends { id: string }>(options: {
  entity: EntityKind;
  id: string;
  body: TBody;
  remotePath: (id: string) => string;
  mergeRecord: (current: TRecord | null, id: string, body: TBody) => TRecord | Promise<TRecord>;
}): Promise<string> {
  await flushQueuedMutations();

  const effectiveId = await resolveMappedId(options.id);

  if (shouldUseRemote()) {
    try {
      const remote = await apiJson<string>(options.remotePath(effectiveId), {
        method: 'PUT',
        body: JSON.stringify(options.body),
      });
      const current = await readRecord<TRecord>(getStoreName(options.entity), effectiveId);
      await upsertRecord(getStoreName(options.entity), await options.mergeRecord(current, effectiveId, options.body));
      notifyDataChanged();
      return remote;
    } catch {
      // Fall through to queueing below.
    }
  }

  const current = await readRecord<TRecord>(getStoreName(options.entity), effectiveId);
  await upsertRecord(getStoreName(options.entity), await options.mergeRecord(current, effectiveId, options.body));
  await queueMutation({
    id: createLocalId(),
    entity: options.entity,
    action: 'update',
    targetId: effectiveId,
    payload: options.body,
    createdAt: new Date().toISOString(),
  });
  notifyDataChanged();
  return effectiveId;
}

async function handleDeleteMutation(options: {
  entity: EntityKind;
  id: string;
  remotePath: (id: string) => string;
}): Promise<string> {
  await flushQueuedMutations();

  const effectiveId = await resolveMappedId(options.id);

  if (shouldUseRemote()) {
    try {
      const remote = await apiJson<string>(options.remotePath(effectiveId), { method: 'DELETE' });
      await deleteRecord(getStoreName(options.entity), effectiveId);
      notifyDataChanged();
      return remote;
    } catch {
      // Fall through to queueing below.
    }
  }

  await deleteRecord(getStoreName(options.entity), effectiveId);

  const queuedMutations = await listQueuedMutations();
  const matchingMutations = queuedMutations.filter(
    mutation => mutation.entity === options.entity && mutation.targetId === effectiveId,
  );
  const hasPendingCreate = matchingMutations.some(mutation => mutation.action === 'create');

  const nextQueue = queuedMutations.filter(
    mutation => !(mutation.entity === options.entity && mutation.targetId === effectiveId),
  );

  if (!hasPendingCreate) {
    nextQueue.push({
      id: createLocalId(),
      entity: options.entity,
      action: 'delete',
      targetId: effectiveId,
      payload: null,
      createdAt: new Date().toISOString(),
    });
  }

  await replaceQueuedMutations(nextQueue);
  notifyDataChanged();
  return effectiveId;
}

// --- Stations

export async function getStations(): Promise<StationDto[]> {
  if (!(await canUseRemoteRead())) {
    return readAllRecords<StationDto>(ENTITY_STORE_NAMES.station);
  }

  try {
    const stations = await fetchStationsRemote();
    await cacheStations(stations);
    return stations;
  } catch {
    return readAllRecords<StationDto>(ENTITY_STORE_NAMES.station);
  }
}

export function createStation(body: { name: string; latitude: number; longitude: number }): Promise<string> {
  return handleCreateMutation({
    entity: 'station',
    body,
    remotePath: '/api/Station',
    buildRecord: buildStationRecord,
    optimisticCreate: createOptimisticStation,
  });
}

export function updateStation(
  id: string,
  body: { name: string; latitude: number; longitude: number },
): Promise<string> {
  return handleUpdateMutation({
    entity: 'station',
    id,
    body,
    remotePath: targetId => `/api/Station/${targetId}`,
    mergeRecord: (current, targetId, payload) => ({
      ...(current ?? { id: targetId }),
      id: targetId,
      ...payload,
    }),
  });
}

export function deleteStation(id: string): Promise<string> {
  return handleDeleteMutation({
    entity: 'station',
    id,
    remotePath: targetId => `/api/Station/${targetId}`,
  });
}

// --- Storages

export async function getStorages(): Promise<StorageDto[]> {
  if (!(await canUseRemoteRead())) {
    return readAllRecords<StorageDto>(ENTITY_STORE_NAMES.storage);
  }

  try {
    const storages = await fetchStoragesRemote();
    await cacheStorages(storages);
    return storages;
  } catch {
    return readAllRecords<StorageDto>(ENTITY_STORE_NAMES.storage);
  }
}

export function createStorage(body: StorageUpsertBody): Promise<string> {
  return handleCreateMutation({
    entity: 'storage',
    body: {
      ...body,
      fuelItems: normalizeFuelItems(body.fuelItems),
    },
    remotePath: '/api/Storage',
    buildRecord: buildStorageRecord,
    optimisticCreate: createOptimisticStorage,
  });
}

export function updateStorage(id: string, body: StorageUpsertBody): Promise<string> {
  return handleUpdateMutation({
    entity: 'storage',
    id,
    body: {
      ...body,
      fuelItems: normalizeFuelItems(body.fuelItems),
    },
    remotePath: targetId => `/api/Storage/${targetId}`,
    mergeRecord: (current, targetId, payload) => ({
      ...(current ?? { id: targetId }),
      id: targetId,
      name: payload.name,
      latitude: payload.latitude,
      longitude: payload.longitude,
      fuelItems: normalizeFuelItems(payload.fuelItems),
    }),
  });
}

export function deleteStorage(id: string): Promise<string> {
  return handleDeleteMutation({
    entity: 'storage',
    id,
    remotePath: targetId => `/api/Storage/${targetId}`,
  });
}

// --- Fuel requests

function mapFuelRequests(fuelRequests: FuelRequestDto[]): FuelRequestDto[] {
  return fuelRequests.map(request => ({
    ...request,
    items: normalizeFuelItems(request.items),
  }));
}

export async function getFuelRequestsSorted(): Promise<FuelRequestDto[]> {
  if (!(await canUseRemoteRead())) {
    return readAllRecords<FuelRequestDto>(ENTITY_STORE_NAMES.fuelRequest);
  }

  try {
    const fuelRequests = await fetchFuelRequestsRemote();
    const mappedFuelRequests = mapFuelRequests(fuelRequests);
    await cacheFuelRequests(mappedFuelRequests);
    return mappedFuelRequests;
  } catch {
    return readAllRecords<FuelRequestDto>(ENTITY_STORE_NAMES.fuelRequest);
  }
}

export function createFuelRequest(body: FuelRequestUpsertBody): Promise<string> {
  return handleCreateMutation({
    entity: 'fuelRequest',
    body: {
      ...body,
      items: normalizeFuelItems(body.items),
    },
    remotePath: '/api/FuelRequest',
    buildRecord: async (id, payload) => {
      const stationName = await getCachedStationName(payload.stationId);
      return {
        id,
        stationId: payload.stationId,
        stationName,
        storageId: null,
        storageName: null,
        deliveryId: null,
        items: normalizeFuelItems(payload.items),
        priority: payload.priority,
        status: payload.status,
        createdAt: payload.createdAt,
        distanceKm: null,
      };
    },
    optimisticCreate: createOptimisticFuelRequest,
  });
}

export function updateFuelRequest(
  id: string,
  body: FuelRequestUpsertBody,
): Promise<string> {
  return handleUpdateMutation({
    entity: 'fuelRequest',
    id,
    body: {
      ...body,
      items: normalizeFuelItems(body.items),
    },
    remotePath: targetId => `/api/FuelRequest/${targetId}`,
    mergeRecord: async (current, targetId, payload) => {
      const stationName = await getCachedStationName(payload.stationId);
      const next = current ?? {
        id: targetId,
        stationId: payload.stationId,
        stationName,
        storageId: null,
        storageName: null,
        deliveryId: null,
        items: normalizeFuelItems(payload.items),
        priority: payload.priority,
        status: payload.status,
        createdAt: payload.createdAt,
        distanceKm: null,
      };

      return {
        ...next,
        id: targetId,
        stationId: payload.stationId,
        stationName,
        items: normalizeFuelItems(payload.items),
        priority: payload.priority,
        status: payload.status,
        createdAt: payload.createdAt,
      };
    },
  });
}

export function deleteFuelRequest(id: string): Promise<string> {
  return handleDeleteMutation({
    entity: 'fuelRequest',
    id,
    remotePath: targetId => `/api/FuelRequest/${targetId}`,
  });
}

export async function getUrgentFuelRequests(): Promise<UrgentFuelRequestDto[]> {
  if (!(await canUseRemoteRead())) {
    const cached = await readAllRecords<FuelRequestDto>(ENTITY_STORE_NAMES.fuelRequest);
    return cached
      .filter(request => dtoPriorityToUi(request.priority) === 'high' && dtoStatusToUi(request.status) === 'pending')
      .map(request => ({ id: request.id }));
  }

  try {
    return apiJson<UrgentFuelRequestDto[]>('/api/FuelRequest/urgent');
  } catch {
    const cached = await readAllRecords<FuelRequestDto>(ENTITY_STORE_NAMES.fuelRequest);
    return cached
      .filter(request => dtoPriorityToUi(request.priority) === 'high' && dtoStatusToUi(request.status) === 'pending')
      .map(request => ({ id: request.id }));
  }
}

// --- Deliveries

export async function getDeliveries(): Promise<DeliveryDto[]> {
  if (!(await canUseRemoteRead())) {
    return readAllRecords<DeliveryDto>(ENTITY_STORE_NAMES.delivery);
  }

  try {
    const deliveries = await fetchDeliveriesRemote();
    await cacheDeliveries(deliveries);
    return deliveries;
  } catch {
    return readAllRecords<DeliveryDto>(ENTITY_STORE_NAMES.delivery);
  }
}

export function createDelivery(body: DeliveryUpsertBody): Promise<string> {
  return handleCreateMutation({
    entity: 'delivery',
    body,
    remotePath: '/api/Delivery',
    buildRecord: (id, payload) => ({ id, ...payload }),
    optimisticCreate: createOptimisticDelivery,
  });
}

export function updateDelivery(id: string, body: DeliveryUpsertBody): Promise<string> {
  return handleUpdateMutation({
    entity: 'delivery',
    id,
    body,
    remotePath: targetId => `/api/Delivery/${targetId}`,
    mergeRecord: (current, targetId, payload) => ({
      ...(current ?? { id: targetId }),
      id: targetId,
      requestId: payload.requestId,
      storageId: payload.storageId,
      deliveredAmount: payload.deliveredAmount,
      status: payload.status,
      createdAt: payload.createdAt,
    }),
  });
}

scheduleOfflineSync();
