// Presence: a single row per user (see supabase/migrations/*_presence.sql),
// written by the Home Assistant bridge and consumed by LocationProvider to
// auto-switch the active location/room. See docs/presence-plan.md.

import { supabase } from '@/lib/supabase';

export type PresenceSource = 'ble' | 'gps' | 'manual';

export type Presence = {
  owner_id: string;
  location_id: string | null;
  room_id: string | null;
  source: PresenceSource;
  updated_at: string;
};

/** Older than this and the row is ignored (fall back to GPS / manual). */
export const PRESENCE_FRESH_MS = 10 * 60 * 1000;

export function isFreshPresence(p: Pick<Presence, 'updated_at'>, now = Date.now()): boolean {
  const t = new Date(p.updated_at).getTime();
  return Number.isFinite(t) && now - t < PRESENCE_FRESH_MS;
}

export async function fetchPresence(): Promise<Presence | null> {
  const { data } = await supabase.from('presence').select('*').maybeSingle<Presence>();
  return data ?? null;
}

/**
 * Subscribe to the caller's own presence row via Realtime.
 * `onChange` fires on insert/update with the new row. Returns an unsubscribe fn.
 */
export function subscribePresence(ownerId: string, onChange: (p: Presence) => void): () => void {
  const channel = supabase
    .channel(`presence:${ownerId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'presence',
        filter: `owner_id=eq.${ownerId}`,
      },
      (payload) => {
        const row = payload.new as Presence | undefined;
        if (row && row.owner_id) onChange(row);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
