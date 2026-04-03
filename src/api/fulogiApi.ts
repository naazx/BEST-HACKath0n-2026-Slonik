/** Use Vite proxy in dev (`/api` → backend). Override with `VITE_API_BASE` if needed. */
const BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE
  ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, '')
  : '';

export type UiPriority = 'high' | 'medium' | 'low';
export type UiRequestStatus = 'pending' | 'in_process' | 'delivered';

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
  fuelAvailable: number;
}

export interface FuelRequestDto {
  id: string;
  stationId: string;
  fuelAmount: number;
  priority: unknown;
  status: unknown;
  createdAt: string;
}

export interface DeliveryDto {
  id: string;
  requestId: string;
  storageId: string;
  deliveredAmount: number;
  status: unknown;
  createdAt: string;
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
  const res = await fetch(url, { ...init, headers });
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

export function dtoPriorityToUi(p: unknown): UiPriority {
  if (p === 1 || p === 'low') return 'low';
  if (p === 2 || p === 'medium') return 'medium';
  if (p === 3 || p === 'high') return 'high';
  return 'medium';
}

export function uiPriorityToApi(p: UiPriority): string {
  return p === 'low' ? 'low' : p === 'medium' ? 'medium' : 'high';
}

export function dtoStatusToUi(s: unknown): UiRequestStatus {
  if (s === 1 || s === 'await') return 'pending';
  if (s === 2 || s === 'inProgress') return 'in_process';
  if (s === 3 || s === 'done') return 'delivered';
  return 'pending';
}

export function uiStatusToApi(s: UiRequestStatus): string {
  if (s === 'pending') return 'await';
  if (s === 'in_process') return 'inProgress';
  return 'done';
}

// --- Stations

export function getStations(): Promise<StationDto[]> {
  return apiJson<StationDto[]>('/api/Station');
}

export function createStation(body: { name: string; latitude: number; longitude: number }): Promise<string> {
  return apiJson<string>('/api/Station', { method: 'POST', body: JSON.stringify(body) });
}

export function updateStation(
  id: string,
  body: { name: string; latitude: number; longitude: number },
): Promise<string> {
  return apiJson<string>(`/api/Station/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteStation(id: string): Promise<string> {
  return apiJson<string>(`/api/Station/${id}`, { method: 'DELETE' });
}

// --- Storages

export function getStorages(): Promise<StorageDto[]> {
  return apiJson<StorageDto[]>('/api/Storage');
}

export function createStorage(body: {
  name: string;
  latitude: number;
  longitude: number;
  fuelAvailable: number;
}): Promise<string> {
  return apiJson<string>('/api/Storage', { method: 'POST', body: JSON.stringify(body) });
}

export function updateStorage(
  id: string,
  body: { name: string; latitude: number; longitude: number; fuelAvailable: number },
): Promise<string> {
  return apiJson<string>(`/api/Storage/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteStorage(id: string): Promise<string> {
  return apiJson<string>(`/api/Storage/${id}`, { method: 'DELETE' });
}

// --- Fuel requests

export function getFuelRequestsSorted(): Promise<FuelRequestDto[]> {
  return apiJson<FuelRequestDto[]>('/api/FuelRequest/sorted-by-priority-and-status');
}

export function createFuelRequest(body: {
  stationId: string;
  fuelAmount: number;
  priority: string;
  status: string;
  createdAt: string;
}): Promise<string> {
  return apiJson<string>('/api/FuelRequest', { method: 'POST', body: JSON.stringify(body) });
}

export function updateFuelRequest(
  id: string,
  body: {
    stationId: string;
    fuelAmount: number;
    priority: string;
    status: string;
    createdAt: string;
  },
): Promise<string> {
  return apiJson<string>(`/api/FuelRequest/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteFuelRequest(id: string): Promise<string> {
  return apiJson<string>(`/api/FuelRequest/${id}`, { method: 'DELETE' });
}

// --- Deliveries

export function getDeliveries(): Promise<DeliveryDto[]> {
  return apiJson<DeliveryDto[]>('/api/Delivery');
}

export function createDelivery(body: {
  requestId: string;
  storageId: string;
  deliveredAmount: number;
  status: string;
  createdAt: string;
}): Promise<string> {
  return apiJson<string>('/api/Delivery', { method: 'POST', body: JSON.stringify(body) });
}

export function updateDelivery(
  id: string,
  body: {
    requestId: string;
    storageId: string;
    deliveredAmount: number;
    status: string;
    createdAt: string;
  },
): Promise<string> {
  return apiJson<string>(`/api/Delivery/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}
