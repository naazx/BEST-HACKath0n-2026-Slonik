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
  createFuelRequest,
  updateFuelRequest,
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
  storageId: string;
  deliveryId: string | null;
  fuelAmount: number;
  priority: Priority;
  status: RequestStatus;
  createdAt: Date;
  distance: number;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findClosestStorage(station: Station, storagesList: Storage[]): { storage: Storage; distance: number } {
  const bestStorage = storagesList.reduce((best, s) => {
    const d = calculateDistance(station.latitude, station.longitude, s.latitude, s.longitude);
    const bd = calculateDistance(station.latitude, station.longitude, best.latitude, best.longitude);
    return d < bd ? s : best;
  }, storagesList[0]);
  const distance = calculateDistance(
    station.latitude,
    station.longitude,
    bestStorage.latitude,
    bestStorage.longitude,
  );
  return { storage: bestStorage, distance };
}

function pickDelivery(fr: FuelRequestDto, deliveries: DeliveryDto[]): DeliveryDto | undefined {
  const reqStatus = dtoStatusToUi(fr.status);
  const candidates = deliveries.filter(d => d.requestId === fr.id);
  if (candidates.length === 0) return undefined;
  if (reqStatus === 'pending') return undefined;
  if (reqStatus === 'in_process') {
    return (
      candidates.find(d => dtoStatusToUi(d.status) === 'in_process') ??
      candidates.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0]
    );
  }
  return (
    candidates.find(d => dtoStatusToUi(d.status) === 'delivered') ??
    candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  );
}

function mergeFuelRequests(
  fuels: FuelRequestDto[],
  deliveries: DeliveryDto[],
  stationList: Station[],
  storageList: Storage[],
): FuelRequest[] {
  return fuels.map(fr => {
    const delivery = pickDelivery(fr, deliveries);
    const station = stationList.find(s => s.id === fr.stationId);
    let storage: Storage | undefined;
    if (delivery) {
      storage = storageList.find(s => s.id === delivery.storageId);
    } else if (station && storageList.length > 0) {
      storage = findClosestStorage(station, storageList).storage;
    }
    const distance =
      station && storage
        ? calculateDistance(station.latitude, station.longitude, storage.latitude, storage.longitude)
        : 0;
    return {
      id: fr.id,
      stationId: fr.stationId,
      storageId: storage?.id ?? '',
      deliveryId: delivery?.id ?? null,
      fuelAmount: fr.fuelAmount,
      priority: dtoPriorityToUi(fr.priority),
      status: dtoStatusToUi(fr.status),
      createdAt: new Date(fr.createdAt),
      distance,
    };
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

export default function App() {
  const [stations, setStations] = useState<Station[]>([]);
  const [storages, setStorages] = useState<Storage[]>([]);
  const [requests, setRequests] = useState<FuelRequest[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FuelRequest | null>(null);
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
    const [stationList, storageList, deliveryList, fuelList] = await Promise.all([
      getStations(),
      getStorages(),
      getDeliveries(),
      getFuelRequestsSorted(),
    ]);
    setStations(stationList);
    setStorages(storageList);
    setDeliveries(deliveryList);
    const merged = mergeFuelRequests(fuelList, deliveryList, stationList, storageList);
    setRequests(merged);
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
      setResponseStorageId(selectedRequest.storageId || null);
    } else {
      setResponseStorageId(null);
    }
  }, [selectedRequest?.id, selectedRequest?.status]);

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

  const handleCreateRequest = async () => {
    if (storages.length === 0 || stations.length === 0 || !newRequest.stationId) return;
    try {
      setBusy(true);
      await createFuelRequest({
        stationId: newRequest.stationId,
        fuelAmount: newRequest.fuelAmount,
        priority: uiPriorityToApi(newRequest.priority),
        status: 'await',
        createdAt: new Date().toISOString(),
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
        createdAt: selectedRequest.createdAt.toISOString(),
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
    const sid = responseStorageId || selectedRequest.storageId;
    if (!sid) {
      window.alert('Select a storage.');
      return;
    }
    try {
      setBusy(true);
      await createDelivery({
        requestId: selectedRequest.id,
        storageId: sid,
        deliveredAmount: selectedRequest.fuelAmount,
        status: 'inProgress',
        createdAt: new Date().toISOString(),
      });
      await updateFuelRequest(selectedRequest.id, {
        stationId: selectedRequest.stationId,
        fuelAmount: selectedRequest.fuelAmount,
        priority: uiPriorityToApi(selectedRequest.priority),
        status: uiStatusToApi('in_process'),
        createdAt: selectedRequest.createdAt.toISOString(),
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
        createdAt: selectedRequest.createdAt.toISOString(),
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

  const stationForNew = stations.find(s => s.id === newRequest.stationId);
  const closestPreview =
    stationForNew && storages.length > 0 ? findClosestStorage(stationForNew, storages) : null;

  return (
    <div className="size-full bg-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fuel Delivery Management</h1>
            <p className="text-gray-600 mt-1">
              {loading ? 'Loading from API…' : 'Monitor and manage fuel transportation requests'}
            </p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Requests</h2>
            <div className="space-y-3">
              {requests.map(request => {
                const station = stations.find(s => s.id === request.stationId);
                const storage = storages.find(s => s.id === request.storageId);

                return (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className={`p-4 rounded-lg border-2 cursor-pointer hover:shadow-lg transition-shadow ${priorityColors[request.priority]}`}
                  >
                    <div className="flex items-center justify-between">
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
                          <span className="font-medium">{storage?.name ?? 'Unknown storage'}</span>
                          <ArrowRight className="w-4 h-4 shrink-0" />
                          <span className="font-medium">{station?.name ?? 'Unknown station'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{request.fuelAmount.toLocaleString()} L</div>
                        <div className="text-sm">{request.distance.toFixed(1)} km</div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Auto-selected storage (closest)</label>
                  <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                    {closestPreview ? (
                      <>
                        {closestPreview.storage.name}
                        <span className="text-sm text-gray-500 ml-2">({closestPreview.distance.toFixed(1)} km)</span>
                      </>
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

        {selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Request details</h3>
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
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
                    {storages.find(s => s.id === selectedRequest.storageId)?.name ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">To</span>
                  <span className="font-semibold text-right">
                    {stations.find(s => s.id === selectedRequest.stationId)?.name ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Distance</span>
                  <span className="font-semibold">{selectedRequest.distance.toFixed(2)} km</span>
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
                    {selectedRequest.createdAt.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {selectedRequest.status === 'pending' && storages.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-950">Dispatch response</p>
                  <p className="text-xs text-amber-900/80">
                    Choose the storage that will supply this delivery, then confirm to move the request to in process.
                  </p>
                  <label className="block text-sm font-medium text-gray-800">Delivering storage</label>
                  <select
                    value={responseStorageId || selectedRequest.storageId || storages[0]?.id}
                    onChange={e => setResponseStorageId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {storages.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
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
