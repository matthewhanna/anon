# Room presence via ESPHome + Bermuda + Apple Watch IRK

**Status:** planning — blocked on HA setup (milestone 0)
**Goal:** detect which *room* Matt is in and auto-switch the app's active
location/room, the way GPS geofencing already switches the active location.

## Pipeline

```
Apple Watch (BLE, rotating RPA)
  → resolved via its IRK
  → ESP32 per room · stock ESPHome bluetooth_proxy (active scan)
  → Home Assistant · bluetooth integration + Bermuda
        → sensor.<watch>_area  =  current HA Area
        → automation: area change (debounced) → rest_command
  → Supabase Edge Function (shared secret) → set_presence RPC → presence row (Realtime)
  → app LocationProvider → activeLocationId / activeRoomId
```

Everything downstream of the HA area sensor is app/backend work and is
independent of how presence is detected.

## Tracked device — Apple Watch, no fob

Decided against a dedicated iBeacon fob: the Watch is always worn, advertises
consistently enough (continuity beacons), and costs nothing. The iPhone was
ruled out — iOS throttles BLE advertising hard when idle in a pocket, which
kills room-level latency.

**Getting the IRK** (Identity Resolving Key — 16 bytes / 32 hex, lets HA
resolve the Watch's rotating addresses to one device):

- The Watch has its *own* IRK, separate from the iPhone.
- Extract by bonding the Watch to a BlueZ host and reading
  `IdentityResolvingKey` from `/var/lib/bluetooth/<adapter>/<watch-mac>/info`
  (needs root — the mediaserver sudo-TTY constraint applies; any Linux box
  with a BT adapter works).
- Stable unless the Watch is reset or unpaired/re-paired; re-extract if you
  get a new Watch.

**HA wiring:** Bermuda's config flow accepts a device by IRK directly and
handles resolution + area itself. Optionally also add the core
`private_ble_device` integration with the same IRK for a plain home/away
`device_tracker`.

**Calibration caveat:** the Watch is on your body, so RSSI is attenuated and
drops further when your arm blocks line-of-sight to a node — occasional
wrong-room flips. Tune Bermuda's `ref_power` / per-scanner offsets with the
Watch actually worn.

## Hardware

| item | choice |
|---|---|
| Room nodes | 1× ESP32 devkit / ESP32-C3 supermini per tracked room (~$4–6), USB power |
| Firmware | ESPHome `bluetooth_proxy: { active: true }` + `esp32_ble_tracker` (ready-made image at esphome.io/projects) |
| Beacon | none — Apple Watch IRK |

Node `name:` room-descriptive (`ble-office`, `ble-kitchen`); set each node's
device **Area** in HA — Bermuda resolves "device is in the Area of the
strongest filtered scanner."

## Home Assistant

1. `bluetooth` integration enabled (proxies act as adapters if the host has no BT).
2. Adopt each proxy in the ESPHome dashboard; assign each to an HA Area.
3. **Bermuda** via HACS (or manual `custom_components/bermuda`). Add the Watch
   by IRK; it auto-discovers the proxies as scanners.
4. **Calibration** — global `ref_power` (RSSI @ 1 m), per-scanner offsets,
   `max_radius` per Area so rooms don't bleed. Expect a few tuning sessions.
5. Output entity: `sensor.<watch>_area`.

## HA → Supabase bridge (no add-ons)

Area → room map lives in the automation as a dict (HA area name → app
`room_id` UUID). Manual for v1; a "link room to HA area" Settings screen is a
later nicety.

```yaml
rest_command:
  set_presence:
    url: "https://<edge-fn-url>/set-presence"
    method: POST
    headers:
      x-ha-secret: !secret ha_presence_secret
      content-type: application/json
    payload: '{"room_id": "{{ room_id }}", "source": "ble"}'

automation:
  - trigger:
      - platform: state
        entity_id: sensor.watch_area
        for: "00:00:05"          # debounce flapping
    action:
      - variables:
          area_map:
            Office: "<room-uuid>"
            Kitchen: "<room-uuid>"
      - choose:
          - conditions: "{{ trigger.to_state.state in area_map }}"
            sequence:
              - service: rest_command.set_presence
                data:
                  room_id: "{{ area_map[trigger.to_state.state] }}"
```

## Supabase

**Migration** — `presence` table, one row per user:
```
presence(
  owner_id    uuid primary key references auth.users default auth.uid(),
  location_id uuid references locations,
  room_id     uuid references rooms,
  source      text check (source in ('ble','gps','manual')),
  updated_at  timestamptz not null default now()
)
```
- RLS: owner reads/writes own row.
- `set_presence(p_room_id uuid, p_source text)` — `SECURITY DEFINER`; derives
  `owner_id` from `auth.uid()`, `location_id` from `rooms.location_id`; upserts.
- Add `presence` to the `supabase_realtime` publication.
- Regenerate `schema.sql` (migration → `db reset` → `db dump` → commit).

**Edge Function `set-presence`** — HA holds only a shared secret, never a
Supabase key:
- verify `x-ha-secret`
- single user → env `PRESENCE_OWNER_ID`
- upsert via the service key server-side

*Interim to prove the pipe:* `service_role` key in HA `secrets.yaml`, POST
straight to `/rest/v1/rpc/set_presence`. Swap to the Edge Function before real.

## App

**`LocationProvider`:**
- On mount: fetch `presence`; if `updated_at` < ~10 min, `source !== 'manual'`,
  and "Follow my location" is on → seed `activeLocationId` / `activeRoomId`.
- Realtime subscription on `presence` filtered to own `owner_id`. On change:
  same gate → set location (if changed) then room.
- **Precedence:** manual override > fresh BLE presence > GPS geofence > first
  location. GPS `syncToPosition` only sets `activeLocationId`, and skips when a
  BLE presence row is fresh.
- Sequencing: setting `activeLocationId` triggers the rooms reload; then apply
  `activeRoomId` (guard the rooms effect so it doesn't clear a valid incoming
  room).

**Settings:** a **"Follow my location"** toggle (persisted, default on) — gates
*all* auto-switching (GPS + BLE). Optionally show "Detected: Office (room
sensor)".

## Milestones — don't skip ahead

0. **Stand up Home Assistant.** Standalone task; everything below assumes a
   healthy HA. It's been dormant a long time — plan on a **fresh install**
   rather than a long-gap upgrade. Likely target: HA Container on `mediaserver`
   (the Bermuda path needs no MQTT; HACS works in Container). Back up the old
   config dir first (Zigbee/Z-Wave keys, any automations worth keeping).
1. One node → ESPHome bluetooth proxy → shows as a BT scanner in HA.
2. Extract the Watch IRK; add to Bermuda → `sensor.watch_area` correct for that
   one room.
3. All nodes + Areas assigned → calibrate until room changes are reliable
   (<30 s, rare false flips). **Gate the rest on this.**
4. Supabase: `presence` table + RPC + Edge Function + Realtime.
5. HA automation → bridge writes on area change.
6. App: `LocationProvider` subscription + precedence + Settings toggle.

## Risks

- Watch advertising goes sparse on wrist-down / theater mode / very low
  battery; expect 10–30 s latency on room changes.
- Body attenuation → occasional wrong-room flips near walls / when your arm
  blocks a node.
- IRK extraction is a one-time root + BLE-bonding faff; re-do on a new Watch.
- HA host CPU: proxies forward a lot of adverts; watch it on a small box, use
  MAC allowlists / passive scan if needed.
- Presence staleness (HA/LAN down): app must fall back to GPS/manual past the
  age threshold — don't strand on a stale room.
