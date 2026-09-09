# docs/

Design notes and deployment config for the location / presence features.

| File | What |
|---|---|
| [`geofencing-plan.md`](geofencing-plan.md) | GPS geofencing plan — foreground location layer (shipped) + deferred background geofencing / arrival notifications. |
| [`presence-plan.md`](presence-plan.md) | Room-level presence: Apple Watch/iPhone BLE → ESPHome proxies → Bermuda → Supabase `presence` → app auto-switch. |
| [`ha-presence-bridge.yaml`](ha-presence-bridge.yaml) | Mirror of the deployed Home Assistant wiring (`rest_command` + area-change automation). Live copy is on the mediaserver at `/opt/homeassistant/config/`, not version-controlled. |
| [`esphome/bt-proxy.example.yaml`](esphome/bt-proxy.example.yaml) | ESPHome Bluetooth-proxy node config (Seeed XIAO ESP32-C3). Live per-room files: mediaserver `~/projects/XiaoSeeedStudio/`. |
| [`esphome/secrets.example.yaml`](esphome/secrets.example.yaml) | Wi-Fi secrets template for the proxy nodes. |

The backend/app side of presence lives in the repo: `supabase/migrations/*_presence.sql`,
`supabase/functions/set-presence/`, `lib/presence.ts`, `lib/follow-location.ts`,
`lib/location-context.tsx`.
