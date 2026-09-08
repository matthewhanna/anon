// Home Assistant -> presence bridge.
//
// HA holds only HA_PRESENCE_SECRET; the Supabase service key never leaves the
// server. HA's area-change automation POSTs { room_id, source? } with the header
// `x-ha-secret`. See docs/ha-presence-bridge.yaml.
//
// verify_jwt is disabled for this function (supabase/config.toml) -- auth is the
// shared-secret header, checked in constant time below.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SECRET = Deno.env.get('HA_PRESENCE_SECRET') ?? '';
const OWNER_ID = Deno.env.get('PRESENCE_OWNER_ID') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // Compare against a fixed-length buffer so length itself isn't a fast oracle.
  const len = Math.max(ab.length, bb.length, 1);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!SECRET || !OWNER_ID || !SUPABASE_URL || !SERVICE_KEY) {
    return new Response('server not configured', { status: 500 });
  }
  if (!timingSafeEqual(req.headers.get('x-ha-secret') ?? '', SECRET)) {
    return new Response('forbidden', { status: 403 });
  }

  let body: { room_id?: string | null; source?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const roomId = body.room_id ?? null;
  const source = body.source ?? 'ble';
  if (source !== 'ble' && source !== 'gps') {
    return new Response('bad source (ble|gps)', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.rpc('set_presence', {
    p_room_id: roomId,
    p_source: source,
    p_owner_id: OWNER_ID,
  });
  if (error) {
    console.error('set_presence failed:', error.message);
    return new Response(error.message, { status: 400 });
  }

  return new Response(null, { status: 204 });
});
