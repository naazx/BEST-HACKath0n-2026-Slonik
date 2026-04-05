import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  MapPin,
  Fuel,
  ArrowRight,
  X,
  Pencil,
  Trash2,
  Warehouse,
  Building2,
  Truck,
} from 'lucide-react';
import {
  type StationDto,
  type StorageDto,
  type FuelRequestDto,
  type DeliveryDto,
  type UrgentFuelRequestDto,
  type UiPriority,
  type UiRequestStatus,
  getStations,
  createStation,
  updateStation,
  deleteStation as apiDeleteStation,
  getStorages,
  createStorage,
  updateStorage,
  deleteStorage as apiDeleteStorage,
  getFuelRequestsSorted,
  getUrgentFuelRequests,
  createFuelRequest,
  updateFuelRequest,
  deleteFuelRequest as apiDeleteFuelRequest,
  getDeliveries,
  createDelivery,
  updateDelivery,
  dtoPriorityToUi,
  dtoStatusToUi,
  uiPriorityToApi,
  uiStatusToApi,
} from '../api/fulogiApi';

type Priority = UiPriority;
type RequestStatus = UiRequestStatus;

interface Station extends StationDto {}
interface Storage extends StorageDto {}

interface FuelRequest {
  id: string;
  stationId: string;
  stationName: string;
  storageId: string | null;
  storageName: string | null;
  deliveryId: string | null;
  fuelAmount: number;
  priority: Priority;
  status: RequestStatus;
  createdAt: Date;
  distanceKm: number | null;
}

interface StorageRecommendation {
  storage: Storage;
  distanceKm: number;
  canFulfill: boolean;
}

const userTimeZone =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

function mapFuelRequests(fuels: FuelRequestDto[]): FuelRequest[] {
  return fuels.map(fr => ({
    id: fr.id,
    stationId: fr.stationId,
    stationName: fr.stationName,
    storageId: fr.storageId,
    storageName: fr.storageName,
    deliveryId: fr.deliveryId,
    fuelAmount: fr.fuelAmount,
    priority: dtoPriorityToUi(fr.priority),
    status: dtoStatusToUi(fr.status),
    createdAt: new Date(fr.createdAt),
    distanceKm: fr.distanceKm,
  }));
}

function toApiDateTime(date: Date): string {
  const pad = (value: number) => String(Math.abs(Math.trunc(value))).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offsetHours = pad(offsetMinutes / 60);
  const offsetRemainderMinutes = pad(offsetMinutes % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainderMinutes}`;
}

function formatRequestDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(userTimeZone ? { timeZone: userTimeZone } : {}),
  }).format(date);
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function getStorageRecommendations(
  station: Station | undefined,
  storages: Storage[],
  requiredFuelAmount: number,
): StorageRecommendation[] {
  if (!station) return [];

  return storages
    .map(storage => ({
      storage,
      distanceKm: calculateDistanceKm(
        station.latitude,
        station.longitude,
        storage.latitude,
        storage.longitude,
      ),
      canFulfill: storage.fuelAvailable >= requiredFuelAmount,
    }))
    .sort((a, b) => {
      if (a.canFulfill !== b.canFulfill) {
        return a.canFulfill ? -1 : 1;
      }
      return a.distanceKm - b.distanceKm;
    });
}

const priorityColors: Record<Priority, string> = {
  high: 'bg-red-100 border-red-300 text-red-800',
  medium: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  low: 'bg-green-100 border-green-300 text-green-800',
};

const statusLabels: Record<RequestStatus, string> = {
  pending: 'Pending',
  in_process: 'In process',
  delivered: 'Delivered',
};

const statusBadgeStyles: Record<RequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  in_process: 'bg-blue-100 text-blue-900 border-blue-200',
  delivered: 'bg-slate-100 text-slate-700 border-slate-200',
};

function showErr(e: unknown) {
  window.alert(e instanceof Error ? e.message : String(e));
}

function getRequestCardClasses(status: RequestStatus, priority: Priority): string {
  if (status === 'delivered') {
    return 'border-slate-200 bg-slate-50/80 text-slate-700 opacity-70';
  }

  if (status === 'in_process') {
    return 'border-blue-200 bg-blue-50/70 text-slate-900';
  }

  return priorityColors[priority];
}

export default function App() {
  const [stations, setStations] = useState<Station[]>([]);
  const [storages, setStorages] = useState<Storage[]>([]);
  const [requests, setRequests] = useState<FuelRequest[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [showModal, setShowModal] = useState(false);
  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FuelRequest | null>(null);
  const [urgentRequestIds, setUrgentRequestIds] = useState<string[]>([]);
  const [newRequest, setNewRequest] = useState({
    stationId: '',
    fuelAmount: 1000,
    priority: 'medium' as Priority,
  });

  const defaultStationForm = () => ({
    name: '',
    latitude: '',
    longitude: '',
  });
  const defaultStorageForm = () => ({
    name: '',
    latitude: '',
    longitude: '',
    fuelAvailable: '',
  });

  const [stationForm, setStationForm] = useState(defaultStationForm);
  const [storageForm, setStorageForm] = useState(defaultStorageForm);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editingStorageId, setEditingStorageId] = useState<string | null>(null);
  const [responseStorageId, setResponseStorageId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [stationList, storageList, deliveryList, fuelList, urgentFuelList] = await Promise.all([
      getStations(),
      getStorages(),
      getDeliveries(),
      getFuelRequestsSorted(),
      getUrgentFuelRequests(),
    ]);
    setStations(stationList);
    setStorages(storageList);
    setDeliveries(deliveryList);
    const merged = mapFuelRequests(fuelList);
    setRequests(merged);
    setUrgentRequestIds(urgentFuelList.map((request: UrgentFuelRequestDto) => request.id));
    setSelectedRequest(prev => {
      if (!prev) return null;
      return merged.find(r => r.id === prev.id) ?? null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadAll();
      } catch (e) {
        if (!cancelled) showErr(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  useEffect(() => {
    if (selectedRequest?.status === 'pending') {
      const station = stations.find(s => s.id === selectedRequest.stationId);
      const recommendedStorage = getStorageRecommendations(
        station,
        storages,
        selectedRequest.fuelAmount,
      )[0];
      setResponseStorageId(recommendedStorage?.storage.id ?? storages[0]?.id ?? null);
    } else {
      setResponseStorageId(null);
    }
  }, [selectedRequest?.id, selectedRequest?.status, selectedRequest?.stationId, selectedRequest?.fuelAmount, storages, stations]);

  useEffect(() => {
    const handleDataChanged = () => {
      void loadAll().catch(showErr);
    };

    const handleOnlineChange = () => {
      setOnline(navigator.onLine);
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
    setNewRequest(nr =>
      nr.stationId && stations.some(s => s.id === nr.stationId) ? nr : { ...nr, stationId: stations[0].id },
    );
  }, [stations]);

  const openNewStation = () => {
    setEditingStationId(null);
    setStationForm(defaultStationForm());
    setShowStationModal(true);
  };

  const openEditStation = (station: Station) => {
    setEditingStationId(station.id);
    setStationForm({
      name: station.name,
      latitude: String(station.latitude),
      longitude: String(station.longitude),
    });
    setShowStationModal(true);
  };

  const openNewStorage = () => {
    setEditingStorageId(null);
    setStorageForm(defaultStorageForm());
    setShowStorageModal(true);
  };

  const openEditStorage = (storage: Storage) => {
    setEditingStorageId(storage.id);
    setStorageForm({
      name: storage.name,
      latitude: String(storage.latitude),
      longitude: String(storage.longitude),
      fuelAvailable: String(storage.fuelAvailable),
    });
    setShowStorageModal(true);
  };

  const saveStation = async () => {
    const lat = Number(stationForm.latitude);
    const lon = Number(stationForm.longitude);
    if (!stationForm.name.trim() || Number.isNaN(lat) || Number.isNaN(lon)) return;
    try {
      setBusy(true);
      const body = { name: stationForm.name.trim(), latitude: lat, longitude: lon };
      if (editingStationId) {
        await updateStation(editingStationId, body);
      } else {
        await createStation(body);
      }
      await loadAll();
      setShowStationModal(false);
      setStationForm(defaultStationForm());
      setEditingStationId(null);
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  const saveStorage = async () => {
    const lat = Number(storageForm.latitude);
    const lon = Number(storageForm.longitude);
    const fuel = Number(storageForm.fuelAvailable);
    if (!storageForm.name.trim() || Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(fuel) || fuel < 0) return;
    try {
      setBusy(true);
      const body = { name: storageForm.name.trim(), latitude: lat, longitude: lon, fuelAvailable: fuel };
      if (editingStorageId) {
        await updateStorage(editingStorageId, body);
      } else {
        await createStorage(body);
      }
      await loadAll();
      setShowStorageModal(false);
      setStorageForm(defaultStorageForm());
      setEditingStorageId(null);
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteStorageLocal = async (id: string) => {
    const blocked = deliveries.some(
      d => d.storageId === id && dtoStatusToUi(d.status) !== 'delivered',
    );
    if (blocked) {
      window.alert('Cannot delete: this storage is linked to an active delivery.');
      return;
    }
    if (!window.confirm('Delete this storage facility?')) return;
    try {
      setBusy(true);
      await apiDeleteStorage(id);
      await loadAll();
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteStationLocal = async (id: string) => {
    const blocked = requests.some(r => r.stationId === id && r.status !== 'delivered');
    if (blocked) {
      window.alert('Cannot delete: this station has an active request.');
      return;
    }
    if (!window.confirm('Delete this station?')) return;
    try {
      setBusy(true);
      await apiDeleteStation(id);
      await loadAll();
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteRequestLocal = async (id: string) => {
    if (!window.confirm('Delete this fuel request?')) return;
    try {
      setBusy(true);
      await apiDeleteFuelRequest(id);
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
      await loadAll();
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRequest = async () => {
    if (storages.length === 0 || stations.length === 0 || !newRequest.stationId) return;
    try {
      setBusy(true);
      await createFuelRequest({
        stationId: newRequest.stationId,
        fuelAmount: newRequest.fuelAmount,
        priority: uiPriorityToApi(newRequest.priority),
        status: 'await',
        createdAt: toApiDateTime(new Date()),
      });
      await loadAll();
      setShowModal(false);
      setNewRequest({
        stationId: stations[0]?.id ?? '',
        fuelAmount: 1000,
        priority: 'medium',
      });
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  const persistPendingUpdate = async (next: {
    priority?: Priority;
    fuelAmount?: number;
  }) => {
    if (!selectedRequest || selectedRequest.status !== 'pending') return;
    const priority = next.priority ?? selectedRequest.priority;
    const fuelAmount = next.fuelAmount ?? selectedRequest.fuelAmount;
    try {
      setBusy(true);
      await updateFuelRequest(selectedRequest.id, {
        stationId: selectedRequest.stationId,
        fuelAmount,
        priority: uiPriorityToApi(priority),
        status: uiStatusToApi('pending'),
        createdAt: toApiDateTime(selectedRequest.createdAt),
      });
      await loadAll();
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  const dispatchFromPending = async () => {
    if (!selectedRequest || selectedRequest.status !== 'pending' || storages.length === 0) return;
    const sid = responseStorageId;
    if (!sid) {
      window.alert('Select a storage.');
      return;
    }
    const storage = storages.find(s => s.id === sid);
    if (!storage) {
      window.alert('Selected storage was not found.');
      return;
    }
    if (storage.fuelAvailable < selectedRequest.fuelAmount) {
      window.alert(
        `Not enough fuel in storage "${storage.name}". Available: ${storage.fuelAvailable.toLocaleString()} L, required: ${selectedRequest.fuelAmount.toLocaleString()} L.`,
      );
      return;
    }
    try {
      setBusy(true);
      await createDelivery({
        requestId: selectedRequest.id,
        storageId: sid,
        deliveredAmount: selectedRequest.fuelAmount,
        status: 'inProgress',
        createdAt: toApiDateTime(new Date()),
      });
      await updateFuelRequest(selectedRequest.id, {
        stationId: selectedRequest.stationId,
        fuelAmount: selectedRequest.fuelAmount,
        priority: uiPriorityToApi(selectedRequest.priority),
        status: uiStatusToApi('in_process'),
        createdAt: toApiDateTime(selectedRequest.createdAt),
      });
      await loadAll();
      setResponseStorageId(null);
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  const markDelivered = async () => {
    if (!selectedRequest || selectedRequest.status !== 'in_process') return;
    const storage = storages.find(s => s.id === selectedRequest.storageId);
    const delivery = deliveries.find(
      d => d.requestId === selectedRequest.id && dtoStatusToUi(d.status) === 'in_process',
    );
    try {
      setBusy(true);
      await updateFuelRequest(selectedRequest.id, {
        stationId: selectedRequest.stationId,
        fuelAmount: selectedRequest.fuelAmount,
        priority: uiPriorityToApi(selectedRequest.priority),
        status: uiStatusToApi('delivered'),
        createdAt: toApiDateTime(selectedRequest.createdAt),
      });
      if (delivery) {
        await updateDelivery(delivery.id, {
          requestId: delivery.requestId,
          storageId: delivery.storageId,
          deliveredAmount: delivery.deliveredAmount,
          status: 'done',
          createdAt: delivery.createdAt,
        });
      }
      if (storage) {
        await updateStorage(storage.id, {
          name: storage.name,
          latitude: storage.latitude,
          longitude: storage.longitude,
          fuelAvailable: Math.max(0, storage.fuelAvailable - selectedRequest.fuelAmount),
        });
      }
      await loadAll();
    } catch (e) {
      showErr(e);
    } finally {
      setBusy(false);
    }
  };

  const stationForNewRequest = stations.find(s => s.id === newRequest.stationId);
  const newRequestRecommendations = getStorageRecommendations(
    stationForNewRequest,
    storages,
    newRequest.fuelAmount,
  );
  const recommendedStorageForNewRequest = newRequestRecommendations[0];

  const selectedRequestStation = selectedRequest
    ? stations.find(s => s.id === selectedRequest.stationId)
    : undefined;
  const responseStorageRecommendations = getStorageRecommendations(
    selectedRequestStation,
    storages,
    selectedRequest?.fuelAmount ?? 0,
  );
  const recommendedResponseStorage = responseStorageRecommendations[0];
  const requestsByStatus: Record<RequestStatus, FuelRequest[]> = {
    pending: requests.filter(request => request.status === 'pending'),
    in_process: requests.filter(request => request.status === 'in_process'),
    delivered: requests.filter(request => request.status === 'delivered'),
  };
  const urgentRequests = requests.filter(request => urgentRequestIds.includes(request.id));

  return (
    <div className="size-full bg-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fuel Delivery Management</h1>
            <p className="text-gray-600 mt-1">
              {loading ? 'Loading from API…' : 'Monitor and manage fuel transportation requests'}
            </p>
            <div
              className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {online ? 'Online and syncing' : 'Offline mode enabled'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={openNewStation}
              className="flex items-center gap-2 border border-gray-300 bg-white text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Building2 className="w-5 h-5 text-gray-600" />
              New station
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={openNewStorage}
              className="flex items-center gap-2 border border-gray-300 bg-white text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Warehouse className="w-5 h-5 text-gray-600" />
              New storage
            </button>
            <button
              type="button"
              disabled={busy || stations.length === 0 || storages.length === 0}
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              New request
            </button>
          </div>
        </div>

        {!loading && urgentRequests.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide text-red-700">Critical requests</div>
                <p className="mt-1 text-sm text-red-900">
                  {urgentRequests.length} high-priority pending request{urgentRequests.length === 1 ? '' : 's'} need attention now.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowUrgentModal(true)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                View critical requests
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Requests</h2>
            <div className="space-y-5">
              {(['pending', 'in_process', 'delivered'] as RequestStatus[]).map(status => (
                <section
                  key={status}
                  className={`rounded-2xl border p-4 ${
                    status === 'pending'
                      ? 'border-amber-200 bg-amber-50/50'
                      : status === 'in_process'
                        ? 'border-blue-200 bg-blue-50/40'
                        : 'border-slate-200 bg-slate-100/60'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${statusBadgeStyles[status]}`}>
                        {statusLabels[status]}
                      </span>
                      <span className="text-sm text-gray-600">
                        {requestsByStatus[status].length} request{requestsByStatus[status].length === 1 ? '' : 's'}
                      </span>
                    </div>
                    {status === 'delivered' && (
                      <span className="text-xs text-slate-500">Completed shipments are shown with lower emphasis.</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {requestsByStatus[status].map(request => (
                      <div
                        key={request.id}
                        onClick={() => setSelectedRequest(request)}
                        className={`p-4 rounded-lg border-2 cursor-pointer hover:shadow-lg transition-shadow ${getRequestCardClasses(request.status, request.priority)}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="font-semibold font-mono text-sm">{request.id.slice(0, 8)}…</span>
                              <span
                                className={`text-xs px-2 py-1 rounded-full border font-medium ${statusBadgeStyles[request.status]}`}
                              >
                                {statusLabels[request.status]}
                              </span>
                              <span className="text-xs px-2 py-1 bg-white/80 rounded-full uppercase">
                                {request.priority}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-4 h-4 shrink-0" />
                              <span className="font-medium">
                                {request.status === 'pending' ? '' : (request.storageName ?? 'Unknown storage')}
                              </span>
                              <ArrowRight className="w-4 h-4 shrink-0" />
                              <span className="font-medium">{request.stationName || 'Unknown station'}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{request.fuelAmount.toLocaleString()} L</div>
                            <div className="text-sm">
                              {request.distanceKm == null ? '' : `${request.distanceKm.toFixed(1)} km`}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={e => {
                              e.stopPropagation();
                              void deleteRequestLocal(request.id);
                            }}
                            className="shrink-0 p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                            title="Delete request"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {requestsByStatus[status].length === 0 && (
                      <p className="py-4 text-sm text-gray-500 text-center">No {statusLabels[status].toLowerCase()} requests.</p>
                    )}
                  </div>
                </section>
              ))}
              {!loading && requests.length === 0 && (
                <p className="text-gray-500 text-sm py-8 text-center">No requests yet. Create stations, storage, then a request.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Storage facilities</h2>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Fuel (L)</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {storages.map(storage => (
                      <tr key={storage.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{storage.name}</div>
                          <div className="text-xs text-gray-500">
                            {storage.latitude.toFixed(4)}, {storage.longitude.toFixed(4)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Fuel className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-gray-900">{storage.fuelAvailable.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={e => {
                                e.stopPropagation();
                                openEditStorage(storage);
                              }}
                              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                              title="Edit storage"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={e => {
                                e.stopPropagation();
                                void deleteStorageLocal(storage.id);
                              }}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Delete storage"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!loading && storages.length === 0 && (
                  <p className="px-4 py-6 text-sm text-gray-500 text-center">No storage facilities yet.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Stations</h2>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stations.map(station => (
                      <tr key={station.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{station.name}</div>
                          <div className="text-xs text-gray-500">
                            {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={e => {
                                e.stopPropagation();
                                openEditStation(station);
                              }}
                              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                              title="Edit station"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={e => {
                                e.stopPropagation();
                                void deleteStationLocal(station.id);
                              }}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Delete station"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!loading && stations.length === 0 && (
                  <p className="px-4 py-6 text-sm text-gray-500 text-center">No stations yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">New Fuel Request</h3>
                <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery station</label>
                  <select
                    value={newRequest.stationId}
                    onChange={e => setNewRequest({ ...newRequest, stationId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {stations.map(station => (
                      <option key={station.id} value={station.id}>
                        {station.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Closest storage</label>
                  <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                    {recommendedStorageForNewRequest ? (
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">{recommendedStorageForNewRequest.storage.name}</div>
                        <div className="text-sm text-gray-500">
                          {recommendedStorageForNewRequest.distanceKm.toFixed(1)} km away
                        </div>
                        {!recommendedStorageForNewRequest.canFulfill && (
                          <div className="text-xs text-red-600">
                            No storage currently has enough fuel for this request. This is the closest option.
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">Add at least one station and storage.</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as Priority[]).map(priority => (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => setNewRequest({ ...newRequest, priority })}
                        className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                          newRequest.priority === priority
                            ? priorityColors[priority]
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fuel amount (L)</label>
                  <input
                    type="number"
                    value={newRequest.fuelAmount}
                    onChange={e => setNewRequest({ ...newRequest, fuelAmount: Number(e.target.value) })}
                    min="100"
                    step="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCreateRequest()}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Create request
              </button>
            </div>
          </div>
        )}

        {showUrgentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Critical Requests</h3>
                  <p className="text-sm text-gray-600">High-priority pending requests that require an immediate response.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUrgentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3">
                {urgentRequests.map(request => {
                  const urgentStation = stations.find(station => station.id === request.stationId);
                  const urgentRecommendations = getStorageRecommendations(
                    urgentStation,
                    storages,
                    request.fuelAmount,
                  );
                  const urgentRecommendedStorage = urgentRecommendations[0];

                  return (
                    <div key={request.id} className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-red-950">{request.id.slice(0, 8)}…</span>
                            <span className="rounded-full border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700">
                              Critical
                            </span>
                          </div>
                          <div className="text-sm text-gray-900">
                            <span className="font-medium">Destination:</span> {request.stationName}
                          </div>
                          <div className="text-sm text-gray-900">
                            <span className="font-medium">Fuel amount:</span> {request.fuelAmount.toLocaleString()} L
                          </div>
                          <div className="text-sm text-gray-900">
                            <span className="font-medium">Created:</span> {formatRequestDateTime(request.createdAt)}
                          </div>
                          {urgentRecommendedStorage && (
                            <div className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm">
                              <div className="font-medium text-gray-900">
                                Recommended storage: {urgentRecommendedStorage.storage.name}
                              </div>
                              <div className="text-gray-600">
                                Distance: {urgentRecommendedStorage.distanceKm.toFixed(1)} km
                              </div>
                              {!urgentRecommendedStorage.canFulfill && (
                                <div className="text-red-600">This storage is closest, but it does not have enough fuel.</div>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setShowUrgentModal(false);
                            setSelectedRequest(request);
                          }}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Respond
                        </button>
                      </div>
                    </div>
                  );
                })}
                {urgentRequests.length === 0 && (
                  <p className="py-8 text-center text-sm text-gray-500">No critical requests at the moment.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Request details</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deleteRequestLocal(selectedRequest.id)}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Delete request"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Request ID</span>
                  <span className="font-semibold font-mono text-xs max-w-[200px] truncate">{selectedRequest.id}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Status</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full border font-medium ${statusBadgeStyles[selectedRequest.status]}`}
                  >
                    {statusLabels[selectedRequest.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Priority</span>
                  {selectedRequest.status === 'pending' ? (
                    <div className="flex flex-wrap gap-1 justify-end">
                      {(['low', 'medium', 'high'] as Priority[]).map(priority => (
                        <button
                          key={priority}
                          type="button"
                          disabled={busy}
                          onClick={() => void persistPendingUpdate({ priority })}
                          className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${
                            selectedRequest.priority === priority
                              ? priorityColors[priority]
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          } disabled:opacity-50`}
                        >
                          {priority}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[selectedRequest.priority]}`}>
                      {selectedRequest.priority.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">From</span>
                  <span className="font-semibold text-right">
                    {selectedRequest.status === 'pending' ? '' : (selectedRequest.storageName ?? '—')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">To</span>
                  <span className="font-semibold text-right">
                    {selectedRequest.stationName || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Distance</span>
                  <span className="font-semibold">{selectedRequest.distanceKm == null ? '' : `${selectedRequest.distanceKm.toFixed(2)} km`}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Fuel amount</span>
                  {selectedRequest.status === 'pending' ? (
                    <input
                      type="number"
                      min={100}
                      step={100}
                      defaultValue={selectedRequest.fuelAmount}
                      key={`${selectedRequest.id}-${selectedRequest.fuelAmount}`}
                      onBlur={e => {
                        const v = Number(e.target.value);
                        if (v > 0 && v !== selectedRequest.fuelAmount) {
                          void persistPendingUpdate({ fuelAmount: v });
                        }
                      }}
                      className="w-32 px-2 py-1 border border-gray-300 rounded-lg text-right font-semibold"
                    />
                  ) : (
                    <span className="font-semibold">{selectedRequest.fuelAmount.toLocaleString()} L</span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Created</span>
                  <span className="font-semibold">
                    {formatRequestDateTime(selectedRequest.createdAt)}
                  </span>
                </div>
              </div>

              {selectedRequest.status === 'pending' && storages.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-950">Dispatch response</p>
                  <p className="text-xs text-amber-900/80">
                    Choose the storage that will supply this delivery, then confirm to move the request to in process.
                  </p>
                  {recommendedResponseStorage && (
                    <div className="rounded-lg border border-amber-200/80 bg-white/70 p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-amber-900/80">Recommended storage</div>
                      <div className="mt-1 font-medium text-gray-900">{recommendedResponseStorage.storage.name}</div>
                      <div className="text-sm text-gray-600">
                        {recommendedResponseStorage.distanceKm.toFixed(1)} km away
                      </div>
                      {!recommendedResponseStorage.canFulfill && (
                        <div className="mt-1 text-xs text-red-600">
                          No storage currently has enough fuel for this request. This is the closest option.
                        </div>
                      )}
                    </div>
                  )}
                  <label className="block text-sm font-medium text-gray-800">Delivering storage</label>
                  <select
                    value={responseStorageId || recommendedResponseStorage?.storage.id || storages[0]?.id}
                    onChange={e => setResponseStorageId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {responseStorageRecommendations.map(({ storage, distanceKm, canFulfill }, index) => (
                      <option key={storage.id} value={storage.id}>
                        {storage.name} • {distanceKm.toFixed(1)} km
                        {index === 0 ? ' • recommended' : ''}
                        {canFulfill ? '' : ' • insufficient fuel'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void dispatchFromPending()}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Truck className="w-4 h-4" />
                    Confirm dispatch
                  </button>
                </div>
              )}

              {selectedRequest.status === 'in_process' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void markDelivered()}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                >
                  Mark as delivered
                </button>
              )}

              {selectedRequest.status === 'delivered' && (
                <p className="text-sm text-center text-gray-600 py-2">This delivery is complete.</p>
              )}
            </div>
          </div>
        )}

        {showStationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingStationId != null ? 'Edit station' : 'New station'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowStationModal(false);
                    setEditingStationId(null);
                    setStationForm(defaultStationForm());
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    value={stationForm.name}
                    onChange={e => setStationForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                      value={stationForm.latitude}
                      onChange={e => setStationForm(f => ({ ...f, latitude: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                      value={stationForm.longitude}
                      onChange={e => setStationForm(f => ({ ...f, longitude: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveStation()}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {showStorageModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingStorageId != null ? 'Edit storage' : 'New storage'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowStorageModal(false);
                    setEditingStorageId(null);
                    setStorageForm(defaultStorageForm());
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    value={storageForm.name}
                    onChange={e => setStorageForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                      value={storageForm.latitude}
                      onChange={e => setStorageForm(f => ({ ...f, latitude: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                      value={storageForm.longitude}
                      onChange={e => setStorageForm(f => ({ ...f, longitude: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuel available (L)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={storageForm.fuelAvailable}
                    onChange={e => setStorageForm(f => ({ ...f, fuelAvailable: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveStorage()}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
