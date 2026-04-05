import { useEffect } from 'react';
import { Icon, latLngBounds, type LatLngBoundsExpression, type LatLngTuple } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

export interface MapLocation {
  latitude: number;
  longitude: number;
}

export const LVIV_CENTER: LatLngTuple = [49.8397, 24.0297];
export const LVIV_OBLAST_BOUNDS: LatLngBoundsExpression = [
  [48.6, 22.2],
  [50.5, 25.6],
];

const lvivBounds = latLngBounds(LVIV_OBLAST_BOUNDS);
const marker = new Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconAnchor: [12, 41],
  iconSize: [25, 41],
  shadowSize: [41, 41],
});

function toLatLngTuple(location: MapLocation | null): LatLngTuple | null {
  if (!location) return null;
  return [location.latitude, location.longitude];
}

export function isWithinLvivOblast(location: MapLocation): boolean {
  return lvivBounds.contains([location.latitude, location.longitude]);
}

function MapViewportSync({ location, zoom }: { location: MapLocation | null; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      const position = toLatLngTuple(location);
      map.setView(position ?? LVIV_CENTER, position ? zoom : 9, { animate: false });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location, map, zoom]);

  return null;
}

function ClickLocationHandler({
  onSelect,
}: {
  onSelect: (location: MapLocation) => void;
}) {
  useMapEvents({
    click(event) {
      const next = {
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      };

      if (isWithinLvivOblast(next)) {
        onSelect(next);
      }
    },
  });

  return null;
}

interface BaseLocationMapProps {
  className?: string;
  location: MapLocation | null;
  zoom?: number;
}

export function LocationPickerMap({
  className = '',
  location,
  zoom = 10,
  onSelect,
}: BaseLocationMapProps & {
  onSelect: (location: MapLocation) => void;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className}`.trim()}>
      <MapContainer
        center={LVIV_CENTER}
        className="h-full min-h-[220px] w-full"
        maxBounds={LVIV_OBLAST_BOUNDS}
        maxBoundsViscosity={1}
        minZoom={8}
        scrollWheelZoom={false}
        zoom={9}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewportSync location={location} zoom={zoom} />
        <ClickLocationHandler onSelect={onSelect} />
        {location && <Marker icon={marker} position={toLatLngTuple(location)!} />}
      </MapContainer>
    </div>
  );
}

export function LocationPreviewMap({
  className = '',
  location,
  zoom = 11,
}: BaseLocationMapProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className}`.trim()}>
      <MapContainer
        center={toLatLngTuple(location) ?? LVIV_CENTER}
        className="h-full min-h-[220px] w-full"
        dragging={false}
        doubleClickZoom={false}
        maxBounds={LVIV_OBLAST_BOUNDS}
        maxBoundsViscosity={1}
        minZoom={8}
        scrollWheelZoom={false}
        touchZoom={false}
        zoom={location ? zoom : 9}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewportSync location={location} zoom={zoom} />
        {location && <Marker icon={marker} position={toLatLngTuple(location)!} />}
      </MapContainer>
    </div>
  );
}
