import type { LatLngBoundsExpression } from 'leaflet';

/** Default view: Lviv Oblast (approx. center). */
export const LVIV_OBLAST_CENTER: [number, number] = [49.8397, 24.0297];

export const LVIV_OBLAST_DEFAULT_ZOOM = 9;

/**
 * Panning is limited to Lviv Oblast and a modest buffer (nearby border areas).
 * Format: [[south, west], [north, east]] for Leaflet LatLngBounds.
 */
export const LVIV_OBLAST_MAX_BOUNDS: LatLngBoundsExpression = [
  [48.92, 22.42],
  [50.88, 25.58],
];

/** 0–1: higher = harder to drag outside maxBounds. */
export const LVIV_OBLAST_MAX_BOUNDS_VISCOSITY = 0.85;
