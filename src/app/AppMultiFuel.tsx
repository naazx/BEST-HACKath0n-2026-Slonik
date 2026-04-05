import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Building2, Fuel, MapPin, Pencil, Plus, Trash2, Truck, Warehouse, X } from 'lucide-react';
import {
  FUEL_TYPES,
  coerceFuelType,
  createDelivery,
  createFuelRequest,
  createStation,
  createStorage,
  deleteFuelRequest as apiDeleteFuelRequest,
  deleteStation as apiDeleteStation,
  deleteStorage as apiDeleteStorage,
  dtoPriorityToUi,
  dtoStatusToUi,
  getDeliveries,
  getFuelRequestsSorted,
  getStations,
  getStorages,
  getUrgentFuelRequests,
  type DeliveryDto,
  type FuelItemDto,
  type FuelRequestDto,
  type FuelType,
  type StationDto,
  type StorageDto,
  type UiPriority,
  type UiRequestStatus,
  uiPriorityToApi,
  uiStatusToApi,
  updateDelivery,
  updateFuelRequest,
  updateStation,
  updateStorage,
} from '../api/fulogiApi';

type Priority = UiPriority;
type RequestStatus = UiRequestStatus;
type FuelFields = Record<FuelType, string>;

interface Station extends StationDto {}
interface Storage extends StorageDto {}
interface FuelRequest {
  id: string;
  stationId: string;
  stationName: string;
  storageId: string | null;
  storageName: string | null;
  deliveryId: string | null;
  items: FuelItemDto[];
  priority: Priority;
  status: RequestStatus;
  createdAt: Date;
  distanceKm: number | null;
}
interface PendingDraft {
  priority: Priority;
  fuelFields: FuelFields;
}
interface StorageRecommendation {
  storage: Storage;
  distanceKm: number;
  canFulfill: boolean;
  missingFuelTypes: FuelType[];
}

const userTimeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
const fuelTypeLabels: Record<FuelType, string> = { A95: 'A-95', A92: 'A-92', Diesel: 'Diesel', LPG: 'LPG' };
const fuelTypeBadgeStyles: Record<FuelType, string> = {
  A95: 'bg-blue-100 text-blue-900 border-blue-200',
  A92: 'bg-cyan-100 text-cyan-900 border-cyan-200',
  Diesel: 'bg-amber-100 text-amber-900 border-amber-200',
  LPG: 'bg-emerald-100 text-emerald-900 border-emerald-200',
};
const priorityColors: Record<Priority, string> = {
  high: 'bg-red-100 border-red-300 text-red-800',
  medium: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  low: 'bg-green-100 border-green-300 text-green-800',
};
const statusLabels: Record<RequestStatus, string> = { pending: 'Pending', in_process: 'In process', delivered: 'Delivered' };
const statusBadgeStyles: Record<RequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  in_process: 'bg-blue-100 text-blue-900 border-blue-200',
  delivered: 'bg-slate-100 text-slate-700 border-slate-200',
};

function emptyFuelFields(): FuelFields {
  return { A95: '', A92: '', Diesel: '', LPG: '' };
}

function normalizeFuelItems(items: FuelItemDto[] | undefined): FuelItemDto[] {
  const totals = new Map<FuelType, number>();
  for (const item of items ?? []) {
    const fuelType = coerceFuelType(item.fuelType);
    const amount = Number(item.amount) || 0;
    if (amount <= 0) continue;
    totals.set(fuelType, (totals.get(fuelType) ?? 0) + amount);
  }
  return FUEL_TYPES.flatMap(fuelType => {
    const amount = totals.get(fuelType) ?? 0;
    return amount > 0 ? [{ fuelType, amount }] : [];
  });
}

function fuelItemsToFields(items: FuelItemDto[] | undefined): FuelFields {
  const next = emptyFuelFields();
  for (const item of normalizeFuelItems(items)) next[item.fuelType] = String(item.amount);
  return next;
}

function fieldsToFuelItems(fields: FuelFields): FuelItemDto[] {
  return FUEL_TYPES.flatMap(fuelType => {
    const amount = Number(fields[fuelType]);
    return Number.isFinite(amount) && amount > 0 ? [{ fuelType, amount }] : [];
  });
}

function sumFuelItems(items: FuelItemDto[] | undefined): number {
  return normalizeFuelItems(items).reduce((sum, item) => sum + item.amount, 0);
}

function fuelAmountFor(items: FuelItemDto[] | undefined, fuelType: FuelType): number {
  return normalizeFuelItems(items).find(item => item.fuelType === fuelType)?.amount ?? 0;
}

function missingFuelTypes(storage: Storage, requestedItems: FuelItemDto[]): FuelType[] {
  return normalizeFuelItems(requestedItems)
    .filter(item => fuelAmountFor(storage.fuelItems, item.fuelType) < item.amount)
    .map(item => item.fuelType);
}

function subtractFuelItems(storageItems: FuelItemDto[], requestedItems: FuelItemDto[]): FuelItemDto[] {
  const next = Object.fromEntries(FUEL_TYPES.map(fuelType => [fuelType, fuelAmountFor(storageItems, fuelType)])) as Record<FuelType, number>;
  for (const item of normalizeFuelItems(requestedItems)) next[item.fuelType] = Math.max(0, next[item.fuelType] - item.amount);
  return FUEL_TYPES.flatMap(fuelType => (next[fuelType] > 0 ? [{ fuelType, amount: next[fuelType] }] : []));
}

function formatFuelTypeList(items: FuelType[]): string {
  return items.map(item => fuelTypeLabels[item]).join(', ');
}

function formatRequestDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', ...(userTimeZone ? { timeZone: userTimeZone } : {}) }).format(date);
}

function toApiDateTime(date: Date): string {
  const pad = (value: number) => String(Math.abs(Math.trunc(value))).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(offsetMinutes / 60)}:${pad(offsetMinutes % 60)}`;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getStorageRecommendations(station: Station | undefined, storages: Storage[], requestedItems: FuelItemDto[]): StorageRecommendation[] {
  const normalizedItems = normalizeFuelItems(requestedItems);
  if (!station || normalizedItems.length === 0) return [];
  return storages
    .map(storage => {
      const missing = missingFuelTypes(storage, normalizedItems);
      return {
        storage,
        distanceKm: calculateDistanceKm(station.latitude, station.longitude, storage.latitude, storage.longitude),
        canFulfill: missing.length === 0,
        missingFuelTypes: missing,
      };
    })
    .sort((left, right) => (left.canFulfill === right.canFulfill ? left.distanceKm - right.distanceKm : left.canFulfill ? -1 : 1));
}

function mapStorages(storages: StorageDto[]): Storage[] {
  return storages.map(storage => ({ ...storage, fuelItems: normalizeFuelItems(storage.fuelItems) }));
}

function mapFuelRequests(requests: FuelRequestDto[]): FuelRequest[] {
  return requests.map(request => ({
    id: request.id,
    stationId: request.stationId,
    stationName: request.stationName,
    storageId: request.storageId,
    storageName: request.storageName,
    deliveryId: request.deliveryId,
    items: normalizeFuelItems(request.items),
    priority: dtoPriorityToUi(request.priority),
    status: dtoStatusToUi(request.status),
    createdAt: new Date(request.createdAt),
    distanceKm: request.distanceKm,
  }));
}

function showErr(error: unknown) {
  window.alert(error instanceof Error ? error.message : String(error));
}

function getRequestCardClasses(status: RequestStatus, priority: Priority): string {
  if (status === 'delivered') return 'border-slate-200 bg-slate-50/80 text-slate-700 opacity-70';
  if (status === 'in_process') return 'border-blue-200 bg-blue-50/70 text-slate-900';
  return priorityColors[priority];
}

function FuelBadges({ items, emptyLabel = 'No fuel specified.' }: { items: FuelItemDto[]; emptyLabel?: string }) {
  const normalizedItems = normalizeFuelItems(items);
  if (normalizedItems.length === 0) return <p className="text-sm text-gray-500">{emptyLabel}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {normalizedItems.map(item => (
        <span key={item.fuelType} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${fuelTypeBadgeStyles[item.fuelType]}`}>
          {fuelTypeLabels[item.fuelType]}: {item.amount.toLocaleString()} L
        </span>
      ))}
    </div>
  );
}

function FuelFieldGrid({ values, onChange }: { values: FuelFields; onChange: (next: FuelFields) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FUEL_TYPES.map(fuelType => (
        <label key={fuelType} className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">{fuelTypeLabels[fuelType]} (L)</span>
          <input
            type="number"
            min={0}
            step={100}
            value={values[fuelType]}
            onChange={event => onChange({ ...values, [fuelType]: event.target.value })}
            placeholder="0"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      ))}
    </div>
  );
}
export default function AppMultiFuel() {
  const [stations, setStations] = useState<Station[]>([]);
  const [storages, setStorages] = useState<Storage[]>([]);
  const [requests, setRequests] = useState<FuelRequest[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryDto[]>([]);
  const [urgentRequestIds, setUrgentRequestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FuelRequest | null>(null);
  const [selectedRequestDraft, setSelectedRequestDraft] = useState<PendingDraft | null>(null);
  const [responseStorageId, setResponseStorageId] = useState<string | null>(null);
  const [newRequest, setNewRequest] = useState(() => ({ stationId: '', priority: 'medium' as Priority, fuelFields: emptyFuelFields() }));
  const defaultStationForm = () => ({ name: '', latitude: '', longitude: '' });
  const defaultStorageForm = () => ({ name: '', latitude: '', longitude: '', fuelFields: emptyFuelFields() });
  const [stationForm, setStationForm] = useState(defaultStationForm);
  const [storageForm, setStorageForm] = useState(defaultStorageForm);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editingStorageId, setEditingStorageId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [stationList, storageList, deliveryList, fuelList, urgentFuelList] = await Promise.all([
      getStations(),
      getStorages(),
      getDeliveries(),
      getFuelRequestsSorted(),
      getUrgentFuelRequests(),
    ]);
    setStations(stationList);
    setStorages(mapStorages(storageList));
    setDeliveries(deliveryList);
    const mappedRequests = mapFuelRequests(fuelList);
    setRequests(mappedRequests);
    setUrgentRequestIds(urgentFuelList.map(request => request.id));
    setSelectedRequest(previous => (previous ? mappedRequests.find(request => request.id === previous.id) ?? null : null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadAll();
      } catch (error) {
        if (!cancelled) showErr(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  useEffect(() => {
    const handleDataChanged = () => {
      void loadAll().catch(showErr);
    };

    const handleOnlineChange = () => {
      setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    };

    window.addEventListener('fulogi:data-changed', handleDataChanged);
    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);

    return () => {
      window.removeEventListener('fulogi:data-changed', handleDataChanged);
      window.removeEventListener('online', handleOnlineChange);
      window.removeEventListener('offline', handleOnlineChange);
    };
  }, [loadAll]);

  useEffect(() => {
    if (stations.length === 0) return;
    setNewRequest(previous => (previous.stationId && stations.some(station => station.id === previous.stationId) ? previous : { ...previous, stationId: stations[0].id }));
  }, [stations]);

  useEffect(() => {
    if (selectedRequest?.status === 'pending') {
      setSelectedRequestDraft({ priority: selectedRequest.priority, fuelFields: fuelItemsToFields(selectedRequest.items) });
      return;
    }
    setSelectedRequestDraft(null);
  }, [selectedRequest]);

  const selectedRequestItems = selectedRequest?.status === 'pending' && selectedRequestDraft ? fieldsToFuelItems(selectedRequestDraft.fuelFields) : selectedRequest?.items ?? [];
  const selectedRequestPriority = selectedRequest?.status === 'pending' && selectedRequestDraft ? selectedRequestDraft.priority : selectedRequest?.priority ?? 'medium';

  useEffect(() => {
    if (selectedRequest?.status !== 'pending') {
      setResponseStorageId(null);
      return;
    }
    const station = stations.find(item => item.id === selectedRequest.stationId);
    const recommendation = getStorageRecommendations(station, storages, selectedRequestItems)[0];
    setResponseStorageId(previous => (previous && storages.some(storage => storage.id === previous) ? previous : recommendation?.storage.id ?? storages[0]?.id ?? null));
  }, [selectedRequest?.id, selectedRequest?.status, selectedRequest?.stationId, selectedRequestItems, stations, storages]);

  const newRequestItems = fieldsToFuelItems(newRequest.fuelFields);
  const newRequestRecommendations = getStorageRecommendations(stations.find(station => station.id === newRequest.stationId), storages, newRequestItems);
  const recommendedStorageForNewRequest = newRequestRecommendations[0];
  const selectedRequestStation = selectedRequest ? stations.find(station => station.id === selectedRequest.stationId) : undefined;
  const responseStorageRecommendations = getStorageRecommendations(selectedRequestStation, storages, selectedRequestItems);
  const recommendedResponseStorage = responseStorageRecommendations[0];
  const requestsByStatus: Record<RequestStatus, FuelRequest[]> = {
    pending: requests.filter(request => request.status === 'pending'),
    in_process: requests.filter(request => request.status === 'in_process'),
    delivered: requests.filter(request => request.status === 'delivered'),
  };
  const urgentRequests = requests.filter(request => urgentRequestIds.includes(request.id));

  const openEditStation = (station: Station) => {
    setEditingStationId(station.id);
    setStationForm({ name: station.name, latitude: String(station.latitude), longitude: String(station.longitude) });
    setShowStationModal(true);
  };
  const openEditStorage = (storage: Storage) => {
    setEditingStorageId(storage.id);
    setStorageForm({ name: storage.name, latitude: String(storage.latitude), longitude: String(storage.longitude), fuelFields: fuelItemsToFields(storage.fuelItems) });
    setShowStorageModal(true);
  };

  const saveStation = async () => {
    const latitude = Number(stationForm.latitude);
    const longitude = Number(stationForm.longitude);
    if (!stationForm.name.trim() || Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    try {
      setBusy(true);
      const body = { name: stationForm.name.trim(), latitude, longitude };
      if (editingStationId) await updateStation(editingStationId, body);
      else await createStation(body);
      await loadAll();
      setShowStationModal(false);
      setEditingStationId(null);
      setStationForm(defaultStationForm());
    } catch (error) {
      showErr(error);
    } finally {
      setBusy(false);
    }
  };

  const saveStorage = async () => {
    const latitude = Number(storageForm.latitude);
    const longitude = Number(storageForm.longitude);
    const fuelItems = fieldsToFuelItems(storageForm.fuelFields);
    if (!storageForm.name.trim() || Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    if (fuelItems.length === 0) {
      window.alert('Add at least one fuel type to the storage.');
      return;
    }
    try {
      setBusy(true);
      const body = { name: storageForm.name.trim(), latitude, longitude, fuelItems };
      if (editingStorageId) await updateStorage(editingStorageId, body);
      else await createStorage(body);
      await loadAll();
      setShowStorageModal(false);
      setEditingStorageId(null);
      setStorageForm(defaultStorageForm());
    } catch (error) {
      showErr(error);
    } finally {
      setBusy(false);
    }
  };

  const deleteStorageLocal = async (storageId: string) => {
    const blocked = deliveries.some(delivery => delivery.storageId === storageId && dtoStatusToUi(delivery.status) !== 'delivered');
    if (blocked) {
      window.alert('Cannot delete: this storage is linked to an active delivery.');
      return;
    }
    if (!window.confirm('Delete this storage facility?')) return;
    try {
      setBusy(true);
      await apiDeleteStorage(storageId);
      await loadAll();
    } catch (error) {
      showErr(error);
    } finally {
      setBusy(false);
    }
  };

  const deleteStationLocal = async (stationId: string) => {
    const blocked = requests.some(request => request.stationId === stationId && request.status !== 'delivered');
    if (blocked) {
      window.alert('Cannot delete: this station has an active request.');
      return;
    }
    if (!window.confirm('Delete this station?')) return;
    try {
      setBusy(true);
      await apiDeleteStation(stationId);
      await loadAll();
    } catch (error) {
      showErr(error);
    } finally {
      setBusy(false);
    }
  };

  const deleteRequestLocal = async (requestId: string) => {
    if (!window.confirm('Delete this fuel request?')) return;
    try {
      setBusy(true);
      await apiDeleteFuelRequest(requestId);
      if (selectedRequest?.id === requestId) setSelectedRequest(null);
      await loadAll();
    } catch (error) {
      showErr(error);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!newRequest.stationId) return;
    if (newRequestItems.length === 0) {
      window.alert('Add at least one requested fuel type.');
      return;
    }
    try {
      setBusy(true);
      await createFuelRequest({ stationId: newRequest.stationId, items: newRequestItems, priority: uiPriorityToApi(newRequest.priority), status: uiStatusToApi('pending'), createdAt: toApiDateTime(new Date()) });
      await loadAll();
      setShowRequestModal(false);
      setNewRequest({ stationId: stations[0]?.id ?? '', priority: 'medium', fuelFields: emptyFuelFields() });
    } catch (error) {
      showErr(error);
    } finally {
      setBusy(false);
    }
  };

  const persistPendingUpdate = async () => {
    if (!selectedRequest || selectedRequest.status !== 'pending' || !selectedRequestDraft) return;
    const items = fieldsToFuelItems(selectedRequestDraft.fuelFields);
    if (items.length === 0) {
      window.alert('A request must contain at least one fuel type.');
      return;
    }
    try {
      setBusy(true);
      await updateFuelRequest(selectedRequest.id, { stationId: selectedRequest.stationId, items, priority: uiPriorityToApi(selectedRequestDraft.priority), status: uiStatusToApi('pending'), createdAt: toApiDateTime(selectedRequest.createdAt) });
      await loadAll();
    } catch (error) {
      showErr(error);
    } finally {
      setBusy(false);
    }
  };
  const dispatchFromPending = async () => {
    if (!selectedRequest || selectedRequest.status !== 'pending' || storages.length === 0) return;
    if (!responseStorageId) {
      window.alert('Select a storage.');
      return;
    }
    const storage = storages.find(item => item.id === responseStorageId);
    if (!storage) {
      window.alert('Selected storage was not found.');
      return;
    }
    const missing = missingFuelTypes(storage, selectedRequestItems);
    if (missing.length > 0) {
      window.alert(`Not enough fuel in storage "${storage.name}". Missing or insufficient: ${formatFuelTypeList(missing)}.`);
      return;
    }
    try {
      setBusy(true);
      await createDelivery({ requestId: selectedRequest.id, storageId: responseStorageId, deliveredAmount: sumFuelItems(selectedRequestItems), status: 'InProgress', createdAt: toApiDateTime(new Date()) });
      await updateFuelRequest(selectedRequest.id, { stationId: selectedRequest.stationId, items: selectedRequestItems, priority: uiPriorityToApi(selectedRequestPriority), status: uiStatusToApi('in_process'), createdAt: toApiDateTime(selectedRequest.createdAt) });
      await updateStorage(storage.id, { name: storage.name, latitude: storage.latitude, longitude: storage.longitude, fuelItems: subtractFuelItems(storage.fuelItems, selectedRequestItems) });
      await loadAll();
      setResponseStorageId(null);
    } catch (error) {
      showErr(error);
    } finally {
      setBusy(false);
    }
  };

  const markDelivered = async () => {
    if (!selectedRequest || selectedRequest.status !== 'in_process') return;
    const delivery = deliveries.find(item => item.requestId === selectedRequest.id && dtoStatusToUi(item.status) === 'in_process');
    try {
      setBusy(true);
      await updateFuelRequest(selectedRequest.id, { stationId: selectedRequest.stationId, items: selectedRequest.items, priority: uiPriorityToApi(selectedRequest.priority), status: uiStatusToApi('delivered'), createdAt: toApiDateTime(selectedRequest.createdAt) });
      if (delivery) {
        await updateDelivery(delivery.id, { requestId: delivery.requestId, storageId: delivery.storageId, deliveredAmount: delivery.deliveredAmount, status: 'Done', createdAt: delivery.createdAt });
      }
      await loadAll();
    } catch (error) {
      showErr(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="size-full overflow-auto bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fuel Delivery Management</h1>
            <p className="mt-1 text-gray-600">{loading ? 'Loading from API...' : 'Monitor and manage multi-fuel delivery requests.'}</p>
            <div
              className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {online ? 'Online and syncing' : 'Offline mode enabled'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => { setEditingStationId(null); setStationForm(defaultStationForm()); setShowStationModal(true); }} className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 hover:bg-gray-50 disabled:opacity-50"><Building2 className="h-5 w-5 text-gray-600" />New station</button>
            <button type="button" disabled={busy} onClick={() => { setEditingStorageId(null); setStorageForm(defaultStorageForm()); setShowStorageModal(true); }} className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 hover:bg-gray-50 disabled:opacity-50"><Warehouse className="h-5 w-5 text-gray-600" />New storage</button>
            <button type="button" disabled={busy || stations.length === 0} onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-5 w-5" />New request</button>
          </div>
        </div>

        {!loading && urgentRequests.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide text-red-700">Critical requests</div>
                <p className="mt-1 text-sm text-red-900">{urgentRequests.length} high-priority pending request{urgentRequests.length === 1 ? '' : 's'} need attention now.</p>
              </div>
              <button type="button" disabled={busy} onClick={() => setShowUrgentModal(true)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">View critical requests</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900">Requests</h2>
            <div className="space-y-5">
              {(['pending', 'in_process', 'delivered'] as RequestStatus[]).map(status => (
                <section key={status} className={`rounded-2xl border p-4 ${status === 'pending' ? 'border-amber-200 bg-amber-50/50' : status === 'in_process' ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-slate-100/60'}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeStyles[status]}`}>{statusLabels[status]}</span>
                      <span className="text-sm text-gray-600">{requestsByStatus[status].length} request{requestsByStatus[status].length === 1 ? '' : 's'}</span>
                    </div>
                    {status === 'delivered' && <span className="text-xs text-slate-500">Completed shipments are shown with lower emphasis.</span>}
                  </div>
                  <div className="space-y-3">
                    {requestsByStatus[status].map(request => (
                      <div key={request.id} onClick={() => setSelectedRequest(request)} className={`cursor-pointer rounded-lg border-2 p-4 transition-shadow hover:shadow-lg ${getRequestCardClasses(request.status, request.priority)}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold">{request.id.slice(0, 8)}...</span>
                              <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeStyles[request.status]}`}>{statusLabels[request.status]}</span>
                              <span className="rounded-full bg-white/80 px-2 py-1 text-xs uppercase">{request.priority}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 shrink-0" /><span className="font-medium">{request.status === 'pending' ? 'Unassigned storage' : request.storageName ?? 'Unknown storage'}</span><ArrowRight className="h-4 w-4 shrink-0" /><span className="font-medium">{request.stationName || 'Unknown station'}</span></div>
                            <FuelBadges items={request.items} />
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="text-right"><div className="font-bold">{sumFuelItems(request.items).toLocaleString()} L</div><div className="text-sm">{request.distanceKm == null ? '' : `${request.distanceKm.toFixed(1)} km`}</div></div>
                            <button type="button" disabled={busy} onClick={event => { event.stopPropagation(); void deleteRequestLocal(request.id); }} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete request"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {requestsByStatus[status].length === 0 && <p className="py-4 text-center text-sm text-gray-500">No {statusLabels[status].toLowerCase()} requests.</p>}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Storage facilities</h2>
              <div className="overflow-x-auto rounded-lg bg-white shadow">
                <table className="min-w-[760px] w-full">
                  <thead className="bg-gray-100"><tr><th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th><th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total fuel</th><th className="min-w-[280px] px-4 py-3 text-left text-sm font-semibold text-gray-900">Fuel mix</th><th className="w-32 whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900">Actions</th></tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {storages.map(storage => (
                      <tr key={storage.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="font-medium text-gray-900">{storage.name}</div><div className="text-xs text-gray-500">{storage.latitude.toFixed(4)}, {storage.longitude.toFixed(4)}</div></td>
                        <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1"><Fuel className="h-4 w-4 text-blue-600" /><span className="font-semibold text-gray-900">{sumFuelItems(storage.fuelItems).toLocaleString()}</span></div></td>
                        <td className="px-4 py-3"><FuelBadges items={storage.fuelItems} emptyLabel="No stored fuel." /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-right"><div className="flex justify-end gap-1"><button type="button" disabled={busy} onClick={() => openEditStorage(storage)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50" title="Edit storage"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={() => void deleteStorageLocal(storage.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete storage"><Trash2 className="h-4 w-4" /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Stations</h2>
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <table className="w-full">
                  <thead className="bg-gray-100"><tr><th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th><th className="w-28 px-4 py-3 text-right text-sm font-semibold text-gray-900">Actions</th></tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {stations.map(station => (
                      <tr key={station.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="font-medium text-gray-900">{station.name}</div><div className="text-xs text-gray-500">{station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}</div></td>
                        <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1"><button type="button" disabled={busy} onClick={() => openEditStation(station)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50" title="Edit station"><Pencil className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={() => void deleteStationLocal(station.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete station"><Trash2 className="h-4 w-4" /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        {showRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg space-y-4 rounded-lg bg-white p-6"><div className="flex items-center justify-between"><h3 className="text-xl font-semibold text-gray-900">New fuel request</h3><button type="button" onClick={() => setShowRequestModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button></div><div className="space-y-4"><div><label className="mb-2 block text-sm font-medium text-gray-700">Delivery station</label><select value={newRequest.stationId} onChange={event => setNewRequest(previous => ({ ...previous, stationId: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2">{stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}</select></div><div><label className="mb-2 block text-sm font-medium text-gray-700">Requested fuel mix</label><FuelFieldGrid values={newRequest.fuelFields} onChange={fuelFields => setNewRequest(previous => ({ ...previous, fuelFields }))} /></div><div><label className="mb-2 block text-sm font-medium text-gray-700">Closest suitable storage</label><div className="rounded-lg bg-gray-100 px-3 py-3 text-gray-700">{recommendedStorageForNewRequest ? <div className="space-y-2"><div className="font-medium text-gray-900">{recommendedStorageForNewRequest.storage.name}</div><div className="text-sm text-gray-500">{recommendedStorageForNewRequest.distanceKm.toFixed(1)} km away</div><FuelBadges items={recommendedStorageForNewRequest.storage.fuelItems} emptyLabel="No stored fuel." />{!recommendedStorageForNewRequest.canFulfill && <div className="text-xs text-red-600">Missing or insufficient: {formatFuelTypeList(recommendedStorageForNewRequest.missingFuelTypes)}.</div>}</div> : newRequestItems.length === 0 ? <span className="text-gray-500">Enter at least one fuel type to see a recommendation.</span> : <span className="text-gray-500">No storage configured yet.</span>}</div></div><div><label className="mb-2 block text-sm font-medium text-gray-700">Priority</label><div className="grid grid-cols-3 gap-2">{(['low', 'medium', 'high'] as Priority[]).map(priority => <button key={priority} type="button" onClick={() => setNewRequest(previous => ({ ...previous, priority }))} className={`rounded-lg border-2 px-4 py-2 transition-colors ${newRequest.priority === priority ? priorityColors[priority] : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</button>)}</div></div><div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-950">Total requested fuel: {sumFuelItems(newRequestItems).toLocaleString()} L</div></div><button type="button" disabled={busy} onClick={() => void handleCreateRequest()} className="w-full rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50">Create request</button></div></div>
        )}

        {showUrgentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg bg-white p-6"><div className="flex items-center justify-between"><div><h3 className="text-xl font-semibold text-gray-900">Critical requests</h3><p className="text-sm text-gray-600">High-priority pending requests that require an immediate response.</p></div><button type="button" onClick={() => setShowUrgentModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button></div><div className="space-y-3">{urgentRequests.map(request => { const station = stations.find(item => item.id === request.stationId); const recommendation = getStorageRecommendations(station, storages, request.items)[0]; return <div key={request.id} className="rounded-xl border border-red-200 bg-red-50/50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-red-950">{request.id.slice(0, 8)}...</span><span className="rounded-full border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700">Critical</span></div><div className="text-sm text-gray-900"><span className="font-medium">Destination:</span> {request.stationName}</div><div className="text-sm text-gray-900"><span className="font-medium">Fuel total:</span> {sumFuelItems(request.items).toLocaleString()} L</div><FuelBadges items={request.items} /><div className="text-sm text-gray-900"><span className="font-medium">Created:</span> {formatRequestDateTime(request.createdAt)}</div>{recommendation && <div className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"><div className="font-medium text-gray-900">Recommended storage: {recommendation.storage.name}</div><div className="text-gray-600">Distance: {recommendation.distanceKm.toFixed(1)} km</div>{!recommendation.canFulfill && <div className="text-red-600">Missing or insufficient: {formatFuelTypeList(recommendation.missingFuelTypes)}.</div>}</div>}</div><button type="button" disabled={busy} onClick={() => { setShowUrgentModal(false); setSelectedRequest(request); }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Respond</button></div></div>; })}</div></div></div>
        )}

        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-white p-6"><div className="flex items-center justify-between"><h3 className="text-xl font-semibold text-gray-900">Request details</h3><div className="flex items-center gap-2"><button type="button" disabled={busy} onClick={() => void deleteRequestLocal(selectedRequest.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete request"><Trash2 className="h-4 w-4" /></button><button type="button" onClick={() => setSelectedRequest(null)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button></div></div><div className="space-y-3"><div className="flex items-center justify-between border-b py-2"><span className="text-gray-600">Request ID</span><span className="max-w-[220px] truncate font-mono text-xs font-semibold">{selectedRequest.id}</span></div><div className="flex items-center justify-between border-b py-2"><span className="text-gray-600">Status</span><span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeStyles[selectedRequest.status]}`}>{statusLabels[selectedRequest.status]}</span></div><div className="flex items-center justify-between border-b py-2"><span className="text-gray-600">Priority</span>{selectedRequest.status === 'pending' && selectedRequestDraft ? <div className="flex flex-wrap justify-end gap-1">{(['low', 'medium', 'high'] as Priority[]).map(priority => <button key={priority} type="button" disabled={busy} onClick={() => setSelectedRequestDraft(previous => previous ? { ...previous, priority } : previous)} className={`rounded-lg border px-2 py-1 text-xs font-medium ${selectedRequestDraft.priority === priority ? priorityColors[priority] : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'} disabled:opacity-50`}>{priority}</button>)}</div> : <span className={`rounded-full px-3 py-1 text-sm font-medium ${priorityColors[selectedRequest.priority]}`}>{selectedRequest.priority.toUpperCase()}</span>}</div><div className="flex items-center justify-between border-b py-2"><span className="text-gray-600">To</span><span className="text-right font-semibold">{selectedRequest.stationName || 'Unknown station'}</span></div>{selectedRequest.status !== 'pending' && <><div className="flex items-center justify-between border-b py-2"><span className="text-gray-600">From</span><span className="text-right font-semibold">{selectedRequest.storageName ?? 'Unknown storage'}</span></div><div className="flex items-center justify-between border-b py-2"><span className="text-gray-600">Distance</span><span className="font-semibold">{selectedRequest.distanceKm == null ? '-' : `${selectedRequest.distanceKm.toFixed(2)} km`}</span></div></>}<div className="flex items-center justify-between border-b py-2"><span className="text-gray-600">Total fuel</span><span className="font-semibold">{sumFuelItems(selectedRequestItems).toLocaleString()} L</span></div><div className="border-b py-2"><div className="mb-2 text-gray-600">Fuel mix</div>{selectedRequest.status === 'pending' && selectedRequestDraft ? <FuelFieldGrid values={selectedRequestDraft.fuelFields} onChange={fuelFields => setSelectedRequestDraft(previous => previous ? { ...previous, fuelFields } : previous)} /> : <FuelBadges items={selectedRequest.items} />}</div><div className="flex items-center justify-between border-b py-2"><span className="text-gray-600">Created</span><span className="font-semibold">{formatRequestDateTime(selectedRequest.createdAt)}</span></div></div>{selectedRequest.status === 'pending' && selectedRequestDraft && <><button type="button" disabled={busy} onClick={() => void persistPendingUpdate()} className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50">Save request changes</button><div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4"><p className="text-sm font-medium text-amber-950">Dispatch response</p><p className="text-xs text-amber-900/80">Choose the storage that will supply this delivery, then confirm to move the request to in process.</p>{recommendedResponseStorage && <div className="rounded-lg border border-amber-200/80 bg-white/70 p-3"><div className="text-xs font-medium uppercase tracking-wide text-amber-900/80">Recommended storage</div><div className="mt-1 font-medium text-gray-900">{recommendedResponseStorage.storage.name}</div><div className="text-sm text-gray-600">{recommendedResponseStorage.distanceKm.toFixed(1)} km away</div><FuelBadges items={recommendedResponseStorage.storage.fuelItems} emptyLabel="No stored fuel." />{!recommendedResponseStorage.canFulfill && <div className="mt-1 text-xs text-red-600">Missing or insufficient: {formatFuelTypeList(recommendedResponseStorage.missingFuelTypes)}.</div>}</div>}<label className="block text-sm font-medium text-gray-800">Delivering storage</label><select value={responseStorageId ?? recommendedResponseStorage?.storage.id ?? storages[0]?.id ?? ''} onChange={event => setResponseStorageId(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2">{responseStorageRecommendations.map(({ storage, distanceKm, canFulfill, missingFuelTypes }, index) => <option key={storage.id} value={storage.id}>{storage.name} | {distanceKm.toFixed(1)} km{index === 0 ? ' | recommended' : ''}{canFulfill ? '' : ` | shortage: ${formatFuelTypeList(missingFuelTypes)}`}</option>)}</select><button type="button" disabled={busy} onClick={() => void dispatchFromPending()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"><Truck className="h-4 w-4" />Confirm dispatch</button></div></>}{selectedRequest.status === 'in_process' && <button type="button" disabled={busy} onClick={() => void markDelivered()} className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50">Mark as delivered</button>}{selectedRequest.status === 'delivered' && <p className="py-2 text-center text-sm text-gray-600">This delivery is complete.</p>}</div></div>
        )}

        {showStationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md space-y-4 rounded-lg bg-white p-6"><div className="flex items-center justify-between"><h3 className="text-xl font-semibold text-gray-900">{editingStationId ? 'Edit station' : 'New station'}</h3><button type="button" onClick={() => { setShowStationModal(false); setEditingStationId(null); setStationForm(defaultStationForm()); }} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button></div><div className="space-y-3"><label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Name</span><input value={stationForm.name} onChange={event => setStationForm(previous => ({ ...previous, name: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></label><div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Latitude</span><input value={stationForm.latitude} onChange={event => setStationForm(previous => ({ ...previous, latitude: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></label><label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Longitude</span><input value={stationForm.longitude} onChange={event => setStationForm(previous => ({ ...previous, longitude: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></label></div></div><button type="button" disabled={busy} onClick={() => void saveStation()} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-50">Save</button></div></div>
        )}

        {showStorageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg space-y-4 rounded-lg bg-white p-6"><div className="flex items-center justify-between"><h3 className="text-xl font-semibold text-gray-900">{editingStorageId ? 'Edit storage' : 'New storage'}</h3><button type="button" onClick={() => { setShowStorageModal(false); setEditingStorageId(null); setStorageForm(defaultStorageForm()); }} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button></div><div className="space-y-3"><label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Name</span><input value={storageForm.name} onChange={event => setStorageForm(previous => ({ ...previous, name: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></label><div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Latitude</span><input value={storageForm.latitude} onChange={event => setStorageForm(previous => ({ ...previous, latitude: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></label><label className="block"><span className="mb-1 block text-sm font-medium text-gray-700">Longitude</span><input value={storageForm.longitude} onChange={event => setStorageForm(previous => ({ ...previous, longitude: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></label></div><div><span className="mb-2 block text-sm font-medium text-gray-700">Stored fuel mix</span><FuelFieldGrid values={storageForm.fuelFields} onChange={fuelFields => setStorageForm(previous => ({ ...previous, fuelFields }))} /></div></div><button type="button" disabled={busy} onClick={() => void saveStorage()} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-50">Save</button></div></div>
        )}
      </div>
    </div>
  );
}
