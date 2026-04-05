import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const proto = L.Icon.Default.prototype as unknown as { _getIconUrl?: string };
delete proto._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export function storageMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'fulogi-marker fulogi-marker-storage',
    html: '<span class="fulogi-marker-dot fulogi-marker-dot--storage"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function stationMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'fulogi-marker fulogi-marker-station',
    html: '<span class="fulogi-marker-dot fulogi-marker-dot--station"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}
