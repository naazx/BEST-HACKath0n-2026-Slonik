import { useState, useEffect } from 'react';
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

// Types
type Priority = 'high' | 'medium' | 'low';
type RequestStatus = 'pending' | 'in_process' | 'delivered';

interface Station {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

interface Storage {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  fuelAvailable: number;
}

interface FuelRequest {
  id: number;
  stationId: number;
  storageId: number;
  fuelAmount: number;
  priority: Priority;
  status: RequestStatus;
  createdAt: Date;
  distance: number;
}

// Mock data
const mockStations: Station[] = [
  { id: 1, name: 'Downtown Station', latitude: 40.7128, longitude: -74.0060 },
  { id: 2, name: 'Airport Station', latitude: 40.6413, longitude: -73.7781 },
  { id: 3, name: 'Suburban Station', latitude: 40.7580, longitude: -73.9855 },
  { id: 4, name: 'Highway Station', latitude: 40.7489, longitude: -73.9680 },
];

const mockStorages: Storage[] = [
  { id: 1, name: 'Central Warehouse', latitude: 40.7306, longitude: -73.9352, fuelAvailable: 50000 },
  { id: 2, name: 'North Depot', latitude: 40.7831, longitude: -73.9712, fuelAvailable: 35000 },
  { id: 3, name: 'East Storage', latitude: 40.7282, longitude: -73.7949, fuelAvailable: 42000 },
];

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find closest storage to a station
function findClosestStorage(station: Station, storages: Storage[]): { storage: Storage; distance: number } {
  let closest = storages[0];
  let minDistance = calculateDistance(station.latitude, station.longitude, closest.latitude, closest.longitude);

  for (const storage of storages) {
    const distance = calculateDistance(station.latitude, station.longitude, storage.latitude, storage.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      closest = storage;
    }
  }

  return { storage: closest, distance: minDistance };
}

// Priority colors
const priorityColors = {
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

function nextEntityId<T extends { id: number }>(items: T[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map(i => i.id)) + 1;
}

export default function App() {
  const [stations, setStations] = useState<Station[]>(() => [...mockStations]);
  const [storages, setStorages] = useState<Storage[]>(() => [...mockStorages]);

  const [requests, setRequests] = useState<FuelRequest[]>([
    {
      id: 1,
      stationId: 1,
      storageId: 1,
      fuelAmount: 5000,
      priority: 'high',
      status: 'pending',
      createdAt: new Date('2026-04-01T08:00:00'),
      distance: 5.2,
    },
    {
      id: 2,
      stationId: 2,
      storageId: 3,
      fuelAmount: 3000,
      priority: 'medium',
      status: 'in_process',
      createdAt: new Date('2026-04-01T09:30:00'),
      distance: 15.8,
    },
    {
      id: 3,
      stationId: 3,
      storageId: 2,
      fuelAmount: 4500,
      priority: 'high',
      status: 'delivered',
      createdAt: new Date('2026-04-01T10:15:00'),
      distance: 3.1,
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FuelRequest | null>(null);
  const [newRequest, setNewRequest] = useState({
    stationId: 1,
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
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [editingStorageId, setEditingStorageId] = useState<number | null>(null);
  const [responseStorageId, setResponseStorageId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedRequest?.status === 'pending') {
      setResponseStorageId(selectedRequest.storageId);
    } else {
      setResponseStorageId(null);
    }
  }, [selectedRequest?.id, selectedRequest?.status]);

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

  const saveStation = () => {
    const lat = Number(stationForm.latitude);
    const lon = Number(stationForm.longitude);
    if (!stationForm.name.trim() || Number.isNaN(lat) || Number.isNaN(lon)) return;

    if (editingStationId != null) {
      setStations(prev =>
        prev.map(s =>
          s.id === editingStationId ? { ...s, name: stationForm.name.trim(), latitude: lat, longitude: lon } : s
        )
      );
      setRequests(prev =>
        prev.map(r => {
          if (r.stationId !== editingStationId) return r;
          const st = { id: editingStationId, name: stationForm.name.trim(), latitude: lat, longitude: lon };
          const storage = storages.find(s => s.id === r.storageId);
          if (!storage) return r;
          return { ...r, distance: calculateDistance(st.latitude, st.longitude, storage.latitude, storage.longitude) };
        })
      );
    } else {
      setStations(prev => [...prev, { id: nextEntityId(prev), name: stationForm.name.trim(), latitude: lat, longitude: lon }]);
    }
    setShowStationModal(false);
    setStationForm(defaultStationForm());
    setEditingStationId(null);
  };

  const saveStorage = () => {
    const lat = Number(storageForm.latitude);
    const lon = Number(storageForm.longitude);
    const fuel = Number(storageForm.fuelAvailable);
    if (!storageForm.name.trim() || Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(fuel) || fuel < 0) return;

    if (editingStorageId != null) {
      setStorages(prev =>
        prev.map(s =>
          s.id === editingStorageId
            ? { ...s, name: storageForm.name.trim(), latitude: lat, longitude: lon, fuelAvailable: fuel }
            : s
        )
      );
      setRequests(prev =>
        prev.map(r => {
          if (r.storageId !== editingStorageId) return r;
          const station = stations.find(s => s.id === r.stationId);
          if (!station) return r;
          const storageEntity = {
            id: editingStorageId,
            name: storageForm.name.trim(),
            latitude: lat,
            longitude: lon,
            fuelAvailable: fuel,
          };
          return {
            ...r,
            distance: calculateDistance(station.latitude, station.longitude, storageEntity.latitude, storageEntity.longitude),
          };
        })
      );
    } else {
      setStorages(prev => [
        ...prev,
        { id: nextEntityId(prev), name: storageForm.name.trim(), latitude: lat, longitude: lon, fuelAvailable: fuel },
      ]);
    }
    setShowStorageModal(false);
    setStorageForm(defaultStorageForm());
    setEditingStorageId(null);
  };

  const deleteStorage = (id: number) => {
    const used = requests.some(r => r.storageId === id && r.status !== 'delivered');
    if (used) {
      window.alert('Cannot delete: this storage is assigned to an active request.');
      return;
    }
    if (!window.confirm('Delete this storage facility?')) return;
    setStorages(prev => prev.filter(s => s.id !== id));
  };

  const deleteStation = (id: number) => {
    const used = requests.some(r => r.stationId === id && r.status !== 'delivered');
    if (used) {
      window.alert('Cannot delete: this station has an active delivery request.');
      return;
    }
    if (!window.confirm('Delete this station?')) return;
    setStations(prev => {
      const filtered = prev.filter(s => s.id !== id);
      setNewRequest(nr =>
        nr.stationId === id ? { ...nr, stationId: filtered[0]?.id ?? nr.stationId } : nr
      );
      return filtered;
    });
  };

  const handleCreateRequest = () => {
    if (storages.length === 0 || stations.length === 0) return;
    setRequests(prev => {
      const station = stations.find(s => s.id === newRequest.stationId)!;
      const { storage, distance } = findClosestStorage(station, storages);
      const request: FuelRequest = {
        id: nextEntityId(prev),
        stationId: newRequest.stationId,
        storageId: storage.id,
        fuelAmount: newRequest.fuelAmount,
        priority: newRequest.priority,
        status: 'pending',
        createdAt: new Date(),
        distance,
      };
      return [...prev, request];
    });
    setShowModal(false);
    setNewRequest({ stationId: stations[0]?.id ?? 1, fuelAmount: 1000, priority: 'medium' });
  };

  const syncSelectedRequest = (updated: FuelRequest) => {
    setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)));
    setSelectedRequest(updated);
  };

  const updatePendingRequestFields = (patch: Partial<Pick<FuelRequest, 'priority' | 'fuelAmount'>>) => {
    if (!selectedRequest || selectedRequest.status !== 'pending') return;
    syncSelectedRequest({ ...selectedRequest, ...patch });
  };

  const dispatchFromPending = () => {
    if (!selectedRequest || selectedRequest.status !== 'pending' || storages.length === 0) return;
    const sid = responseStorageId ?? selectedRequest.storageId;
    const storage = storages.find(s => s.id === sid);
    const station = stations.find(s => s.id === selectedRequest.stationId);
    if (!storage || !station) return;
    const distance = calculateDistance(station.latitude, station.longitude, storage.latitude, storage.longitude);
    syncSelectedRequest({
      ...selectedRequest,
      storageId: sid,
      distance,
      status: 'in_process',
    });
    setResponseStorageId(null);
  };

  const markDelivered = () => {
    if (!selectedRequest || selectedRequest.status !== 'in_process') return;
    const amount = selectedRequest.fuelAmount;
    setStorages(prev =>
      prev.map(s => (s.id === selectedRequest.storageId ? { ...s, fuelAvailable: Math.max(0, s.fuelAvailable - amount) } : s))
    );
    syncSelectedRequest({ ...selectedRequest, status: 'delivered' });
  };

  // Sort requests by priority (high > medium > low) then by distance
  const sortedRequests = [...requests].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.distance - b.distance;
  });

  return (
    <div className="size-full bg-gray-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fuel Delivery Management</h1>
            <p className="text-gray-600 mt-1">Monitor and manage fuel transportation requests</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openNewStation}
              className="flex items-center gap-2 border border-gray-300 bg-white text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Building2 className="w-5 h-5 text-gray-600" />
              New station
            </button>
            <button
              type="button"
              onClick={openNewStorage}
              className="flex items-center gap-2 border border-gray-300 bg-white text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Warehouse className="w-5 h-5 text-gray-600" />
              New storage
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={stations.length === 0 || storages.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              New request
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Requests List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Requests</h2>
            <div className="space-y-3">
              {sortedRequests.map(request => {
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
                          <span className="font-semibold">Request #{request.id}</span>
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
            </div>
          </div>

          {/* Storage & stations */}
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
                            <span className="font-semibold text-gray-900">
                              {storage.fuelAvailable.toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                openEditStorage(storage);
                              }}
                              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                              title="Edit storage"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                deleteStorage(storage.id);
                              }}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50"
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
                {storages.length === 0 && (
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
                              onClick={e => {
                                e.stopPropagation();
                                openEditStation(station);
                              }}
                              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                              title="Edit station"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                deleteStation(station.id);
                              }}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50"
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
                {stations.length === 0 && (
                  <p className="px-4 py-6 text-sm text-gray-500 text-center">No stations yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* New Request Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">New Fuel Request</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Station
                  </label>
                  <select
                    value={newRequest.stationId}
                    onChange={e => setNewRequest({ ...newRequest, stationId: Number(e.target.value) })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auto-selected storage (closest)
                  </label>
                  <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
                    {stations.length > 0 && storages.length > 0 ? (
                      <>
                        {
                          findClosestStorage(stations.find(s => s.id === newRequest.stationId)!, storages)
                            .storage.name
                        }
                        <span className="text-sm text-gray-500 ml-2">
                          (
                          {findClosestStorage(
                            stations.find(s => s.id === newRequest.stationId)!,
                            storages
                          ).distance.toFixed(1)}{' '}
                          km)
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500">Add at least one station and storage.</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as Priority[]).map(priority => (
                      <button
                        key={priority}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fuel Amount (Liters)
                  </label>
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
                onClick={handleCreateRequest}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Request
              </button>
            </div>
          </div>
        )}

        {/* Request Details Modal */}
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
                  <span className="font-semibold">#{selectedRequest.id}</span>
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
                          onClick={() => updatePendingRequestFields({ priority })}
                          className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${
                            selectedRequest.priority === priority
                              ? priorityColors[priority]
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
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
                      value={selectedRequest.fuelAmount}
                      onChange={e => updatePendingRequestFields({ fuelAmount: Number(e.target.value) })}
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
                    value={responseStorageId ?? selectedRequest.storageId}
                    onChange={e => setResponseStorageId(Number(e.target.value))}
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
                    onClick={dispatchFromPending}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Truck className="w-4 h-4" />
                    Confirm dispatch
                  </button>
                </div>
              )}

              {selectedRequest.status === 'in_process' && (
                <button
                  type="button"
                  onClick={markDelivered}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
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

        {/* Station create / edit modal */}
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
                onClick={saveStation}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Storage create / edit modal */}
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
                onClick={saveStorage}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700"
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