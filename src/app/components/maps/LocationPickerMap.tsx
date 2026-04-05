import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import './leafletSetup';
import './mapMarkers.css';
import { ClientOnlyMap } from './ClientOnlyMap';
import {
  LVIV_OBLAST_CENTER,
  LVIV_OBLAST_DEFAULT_ZOOM,
  LVIV_OBLAST_MAX_BOUNDS,
  LVIV_OBLAST_MAX_BOUNDS_VISCOSITY,
} from './lvivMapConfig';

function parseCoord(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCoord(n: number): string {
  return n.toFixed(6);
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToCoords({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 12), { duration: 0.35 });
  }, [lat, lng, map]);
  return null;
}

export function LocationPickerMap({
  latitude,
  longitude,
  onMapClick,
}: {
  latitude: string;
  longitude: string;
  /** When set, map clicks update coordinates (create form only). Omit for read-only detail view. */
  onMapClick?: (lat: string, lng: string) => void;
}) {
  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);
  const hasPosition = lat != null && lng != null;
  const center: [number, number] = hasPosition ? [lat, lng] : LVIV_OBLAST_CENTER;
  const zoom = hasPosition ? 12 : LVIV_OBLAST_DEFAULT_ZOOM;

  const handlePick = (la: number, lo: number) => {
    onMapClick?.(formatCoord(la), formatCoord(lo));
  };

  return (
    <ClientOnlyMap className="h-56 w-full rounded-xl bg-slate-100/90 animate-pulse">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={8}
        maxZoom={18}
        maxBounds={LVIV_OBLAST_MAX_BOUNDS}
        maxBoundsViscosity={LVIV_OBLAST_MAX_BOUNDS_VISCOSITY}
        className="relative z-0 h-56 w-full overflow-hidden rounded-xl border border-slate-200/90 shadow-inner"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onMapClick && <MapClickHandler onPick={handlePick} />}
        {hasPosition && (
          <>
            <Marker position={[lat, lng]} />
            <FlyToCoords lat={lat} lng={lng} />
          </>
        )}
      </MapContainer>
    </ClientOnlyMap>
  );
}
