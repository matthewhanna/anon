// "Follow my location" — one switch that gates ALL automatic active-location /
// active-room switching (GPS geofence + BLE room presence). Device-local,
// default ON.
//
// Storage: localStorage. On web that's native; on native it's the polyfill
// installed by supabase.native.ts (expo-sqlite/localStorage). Reads/writes are
// wrapped in try/catch so a missing/blocked store just falls back to the
// in-memory value (default ON).

const KEY = 'anon.followLocation';

let cached: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

function read(): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw == null ? true : raw === '1';
  } catch {
    return true;
  }
}

export function getFollowLocation(): boolean {
  if (cached === null) cached = read();
  return cached;
}

export function setFollowLocation(value: boolean): void {
  cached = value;
  try {
    globalThis.localStorage?.setItem(KEY, value ? '1' : '0');
  } catch {
    // best-effort; the in-memory value still applies for this session
  }
  for (const fn of listeners) fn(value);
}

export function subscribeFollowLocation(fn: (v: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
