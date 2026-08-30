// Foreground location helpers. See docs/geofencing-plan.md (Phase 0).
// expo-location's foreground APIs work on web (browser geolocation) too, so
// no native/web split is needed here.

import * as Location from 'expo-location';

export type Coords = { latitude: number; longitude: number };
export type LocationPermission = 'granted' | 'denied';

export const DEFAULT_RADIUS_M = 76; // 250 ft
export const MIN_RADIUS_M = 46; // ~150 ft
export const MAX_RADIUS_M = 305; // ~1000 ft

export async function getForegroundPermission(): Promise<LocationPermission> {
  const res = await Location.getForegroundPermissionsAsync();
  return res.granted ? 'granted' : 'denied';
}

export async function requestForegroundPermission(): Promise<LocationPermission> {
  const res = await Location.requestForegroundPermissionsAsync();
  return res.granted ? 'granted' : 'denied';
}

export async function getCurrentCoords(): Promise<Coords> {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

/** Haversine distance in meters. */
export function distanceM(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function clampRadiusM(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RADIUS_M;
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(value)));
}

type Geo = { latitude: number | null; longitude: number | null; radius_m: number | null };

/**
 * The closest item whose circle (center + radius_m, or DEFAULT_RADIUS_M) contains
 * `coords`. Items without coordinates are skipped. null if none match.
 */
export function nearestWithin<T extends Geo>(
  items: T[],
  coords: Coords
): { item: T; distanceM: number } | null {
  let best: { item: T; distanceM: number } | null = null;
  for (const item of items) {
    if (item.latitude == null || item.longitude == null) continue;
    const d = distanceM(coords, { latitude: item.latitude, longitude: item.longitude });
    if (d <= (item.radius_m ?? DEFAULT_RADIUS_M) && (!best || d < best.distanceM)) {
      best = { item, distanceM: d };
    }
  }
  return best;
}
