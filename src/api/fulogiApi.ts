/** Use Vite proxy in dev (`/api` → backend). Override with `VITE_API_BASE` if needed. */
const BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE
  ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, '')
  : '';

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

export function coerceFuelType(value: unknown): FuelType {
  if (value === 1 || value === '1' || value === 'A95' || value === 'a95') return 'A95';
  if (value === 2 || value === '2' || value === 'A92' || value === 'a92') return 'A92';
  if (value === 3 || value === '3' || value === 'Diesel' || value === 'diesel') return 'Diesel';
  if (value === 4 || value === '4' || value === 'LPG' || value === 'lpg') return 'LPG';
  return 'A95';
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

export function createStorage(body: StorageUpsertBody): Promise<string> {
  return apiJson<string>('/api/Storage', { method: 'POST', body: JSON.stringify(body) });
}

export function updateStorage(id: string, body: StorageUpsertBody): Promise<string> {
  return apiJson<string>(`/api/Storage/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteStorage(id: string): Promise<string> {
  return apiJson<string>(`/api/Storage/${id}`, { method: 'DELETE' });
}

// --- Fuel requests

export function getFuelRequestsSorted(): Promise<FuelRequestDto[]> {
  return apiJson<FuelRequestDto[]>('/api/FuelRequest/sorted-by-priority-and-status');
}

export function createFuelRequest(body: FuelRequestUpsertBody): Promise<string> {
  return apiJson<string>('/api/FuelRequest', { method: 'POST', body: JSON.stringify(body) });
}

export function updateFuelRequest(id: string, body: FuelRequestUpsertBody): Promise<string> {
  return apiJson<string>(`/api/FuelRequest/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteFuelRequest(id: string): Promise<string> {
  return apiJson<string>(`/api/FuelRequest/${id}`, { method: 'DELETE' });
}

export function getUrgentFuelRequests(): Promise<UrgentFuelRequestDto[]> {
  return apiJson<UrgentFuelRequestDto[]>('/api/FuelRequest/urgent');
}

// --- Deliveries

export function getDeliveries(): Promise<DeliveryDto[]> {
  return apiJson<DeliveryDto[]>('/api/Delivery');
}

export function createDelivery(body: DeliveryUpsertBody): Promise<string> {
  return apiJson<string>('/api/Delivery', { method: 'POST', body: JSON.stringify(body) });
}

export function updateDelivery(id: string, body: DeliveryUpsertBody): Promise<string> {
  return apiJson<string>(`/api/Delivery/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}
