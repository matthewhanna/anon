import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import {
  getFollowLocation,
  setFollowLocation as setFollowLocationModule,
  subscribeFollowLocation,
} from '@/lib/follow-location';
import { getCurrentCoords, getForegroundPermission, nearestWithin } from '@/lib/location';
import { ensureDefaultLocations, type Location } from '@/lib/locations';
import {
  fetchPresence,
  isFreshPresence,
  PRESENCE_FRESH_MS,
  subscribePresence,
  type Presence,
} from '@/lib/presence';
import { listRooms, type Room } from '@/lib/rooms';

/** After a manual location/room pick, suppress auto-switching for this long. */
const MANUAL_OVERRIDE_MS = 30 * 60 * 1000;

type LocationContextValue = {
  locations: Location[];
  rooms: Room[];
  activeLocationId: string | null;
  activeRoomId: string | null;
  setActiveLocationId: (id: string) => void;
  setActiveRoomId: (id: string | null) => void;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  /** Re-fetch locations (call after add/delete/rename elsewhere). */
  reloadLocations: () => void;
  /** "Follow my location" — gates all GPS + BLE auto-switching. */
  followLocation: boolean;
  setFollowLocation: (value: boolean) => void;
  /** Last presence row seen (for a "Detected: <room>" hint in Settings). */
  lastPresence: Presence | null;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function useLocationContext(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used inside <LocationProvider>');
  return ctx;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? null;

  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeLocationId, setActiveLocationIdState] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomIdState] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [followLocation, setFollowLocationState] = useState(getFollowLocation);
  const [lastPresence, setLastPresence] = useState<Presence | null>(null);

  const locationsRef = useRef<Location[]>([]);
  const lastLocateAtRef = useRef(0);
  const didAutoLocateRef = useRef(false);
  const manualOverrideUntilRef = useRef(0);
  const lastBlePresenceAtRef = useRef(0);
  const pendingRoomIdRef = useRef<string | null>(null);

  // User picked a location/room by hand -> start a manual-override window.
  const setActiveLocationId = useCallback((id: string) => {
    manualOverrideUntilRef.current = Date.now() + MANUAL_OVERRIDE_MS;
    pendingRoomIdRef.current = null;
    setActiveLocationIdState(id);
  }, []);
  const setActiveRoomId = useCallback((id: string | null) => {
    manualOverrideUntilRef.current = Date.now() + MANUAL_OVERRIDE_MS;
    setActiveRoomIdState(id);
  }, []);

  const setFollowLocation = useCallback((value: boolean) => setFollowLocationModule(value), []);
  useEffect(() => subscribeFollowLocation(setFollowLocationState), []);

  const reloadLocations = useCallback(() => {
    ensureDefaultLocations().then(({ data }) => {
      const list = data ?? [];
      setLocations(list);
      locationsRef.current = list;
      setActiveLocationIdState((current) => current ?? list[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    reloadLocations();
  }, [reloadLocations]);

  // Rooms follow the active location; reset the room filter on change. If a
  // presence update stashed a room for this location, apply it once loaded.
  useEffect(() => {
    setActiveRoomIdState(null);
    if (!activeLocationId) {
      setRooms([]);
      return;
    }
    let cancelled = false;
    listRooms(activeLocationId).then(({ data }) => {
      if (cancelled) return;
      const list = data ?? [];
      setRooms(list);
      const pending = pendingRoomIdRef.current;
      if (pending && list.some((r) => r.id === pending)) {
        pendingRoomIdRef.current = null;
        setActiveRoomIdState(pending);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeLocationId]);

  // Apply an incoming presence row, subject to precedence:
  //   manual override > fresh BLE presence > GPS geofence > first location.
  // Reassigned every render so it closes over current state; called from the
  // Realtime subscription and the initial seed.
  const applyPresenceRef = useRef<(p: Presence) => void>(() => {});
  applyPresenceRef.current = (p: Presence) => {
    setLastPresence(p);
    if (!followLocation) return;
    if (p.source === 'manual') return; // echo of our own manual write
    if (!isFreshPresence(p)) return;
    if (Date.now() < manualOverrideUntilRef.current) return;
    if (!p.location_id) return; // "away" / cleared — leave the current context alone

    if (p.source === 'ble') lastBlePresenceAtRef.current = Date.now();

    if (p.location_id !== activeLocationId) {
      pendingRoomIdRef.current = p.room_id;
      setActiveLocationIdState(p.location_id);
      return;
    }

    // Same location — set the room now if we have it, else stash + refresh.
    if (!p.room_id) return;
    if (rooms.some((r) => r.id === p.room_id)) {
      setActiveRoomIdState(p.room_id);
      return;
    }
    pendingRoomIdRef.current = p.room_id;
    listRooms(p.location_id).then(({ data }) => {
      const list = data ?? [];
      setRooms(list);
      const pending = pendingRoomIdRef.current;
      if (pending && list.some((r) => r.id === pending)) {
        pendingRoomIdRef.current = null;
        setActiveRoomIdState(pending);
      }
    });
  };

  // Best-effort: point the active location at wherever we physically are.
  // Never prompts (only if permission already granted); throttled; yields to
  // "Follow my location" off, the manual-override window, and fresh BLE presence.
  const syncToPosition = useCallback(async (opts?: { force?: boolean }) => {
    const locs = locationsRef.current;
    if (locs.length === 0) return;
    if (!getFollowLocation()) return;
    if (Date.now() < manualOverrideUntilRef.current) return;
    if (lastBlePresenceAtRef.current && Date.now() - lastBlePresenceAtRef.current < PRESENCE_FRESH_MS)
      return;
    if (!opts?.force && Date.now() - lastLocateAtRef.current < 30_000) return;
    try {
      if ((await getForegroundPermission()) !== 'granted') return;
      lastLocateAtRef.current = Date.now();
      const coords = await getCurrentCoords();
      const match = nearestWithin(locs, coords);
      if (match) setActiveLocationIdState(match.item.id);
    } catch {
      // best-effort
    }
  }, []);

  // One-shot on first load: prefer a fresh BLE presence row; otherwise GPS.
  useEffect(() => {
    if (didAutoLocateRef.current || locations.length === 0) return;
    didAutoLocateRef.current = true;
    void (async () => {
      if (getFollowLocation()) {
        const p = await fetchPresence();
        if (p && p.location_id && p.source !== 'manual' && isFreshPresence(p)) {
          applyPresenceRef.current(p);
          return;
        }
      }
      void syncToPosition({ force: true });
    })();
  }, [locations, syncToPosition]);

  // Realtime: the HA bridge updates our presence row as rooms change.
  useEffect(() => {
    if (!ownerId) return;
    return subscribePresence(ownerId, (p) => applyPresenceRef.current(p));
  }, [ownerId]);

  // Turning "Follow my location" back on: re-seed from a fresh presence row.
  useEffect(() => {
    if (!followLocation) return;
    void (async () => {
      const p = await fetchPresence();
      if (p && p.location_id && p.source !== 'manual' && isFreshPresence(p)) {
        applyPresenceRef.current(p);
      }
    })();
  }, [followLocation]);

  // On foreground: the Realtime socket was dropped while suspended and won't
  // replay missed changes, so re-fetch presence and apply it before falling
  // back to the GPS sync (fresh BLE presence outranks GPS).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        if (getFollowLocation()) {
          const p = await fetchPresence();
          if (p && p.location_id && p.source !== 'manual' && isFreshPresence(p)) {
            applyPresenceRef.current(p);
            return;
          }
        }
        void syncToPosition();
      })();
    });
    return () => sub.remove();
  }, [syncToPosition]);

  return (
    <LocationContext.Provider
      value={{
        locations,
        rooms,
        activeLocationId,
        activeRoomId,
        setActiveLocationId,
        setActiveRoomId,
        pickerOpen,
        setPickerOpen,
        reloadLocations,
        followLocation,
        setFollowLocation,
        lastPresence,
      }}>
      {children}
    </LocationContext.Provider>
  );
}
