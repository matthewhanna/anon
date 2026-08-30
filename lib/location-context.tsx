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

import { getCurrentCoords, getForegroundPermission, nearestWithin } from '@/lib/location';
import { ensureDefaultLocations, type Location } from '@/lib/locations';
import { listRooms, type Room } from '@/lib/rooms';

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
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function useLocationContext(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used inside <LocationProvider>');
  return ctx;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeLocationId, setActiveLocationIdState] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const locationsRef = useRef<Location[]>([]);
  const lastLocateAtRef = useRef(0);
  const didAutoLocateRef = useRef(false);

  const setActiveLocationId = useCallback((id: string) => setActiveLocationIdState(id), []);

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

  // Rooms follow the active location; reset the room filter on change.
  useEffect(() => {
    setActiveRoomId(null);
    if (!activeLocationId) {
      setRooms([]);
      return;
    }
    listRooms(activeLocationId).then(({ data }) => setRooms(data ?? []));
  }, [activeLocationId]);

  // Best-effort: point the active location at wherever we physically are.
  // Never prompts (only if permission already granted); throttled.
  const syncToPosition = useCallback(async (opts?: { force?: boolean }) => {
    const locs = locationsRef.current;
    if (locs.length === 0) return;
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

  useEffect(() => {
    if (didAutoLocateRef.current || locations.length === 0) return;
    didAutoLocateRef.current = true;
    void syncToPosition({ force: true });
  }, [locations, syncToPosition]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncToPosition();
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
      }}>
      {children}
    </LocationContext.Provider>
  );
}
