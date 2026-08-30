# Geofencing plan

**Status:** in progress — building the foreground-location layer first
**Goal:** when the user arrives at one of their saved locations, notify them of the
pending reminders tied to that location ("remind me when I get home").

## Sequencing

Background geofencing is deferred. We build the **foreground-location layer first**
— it needs only "While Using" permission, no background mode, no headless task, no
notification plumbing, and it produces the coordinate data geofencing depends on.

- **Phase 0a — define places + capture coordinates.** Settings tab is a CRUD list
  of locations (name, geofence summary, Edit / Delete, "Add location"). Edit/Add
  push to `app/location/[id].tsx` (`id === "new"` = create): a full-screen
  `react-native-maps` picker — draggable `Marker`, live `Circle`, radius `Slider`
  (`@react-native-community/slider`), "Use current location", Save. Writes `name`
  + `latitude` / `longitude` / `radius_m`. **Android needs a Google Maps API key**
  (`android.config.googleMaps.apiKey`); iOS uses Apple Maps, no key.
- **Phase 0b — foreground list switching.** The reminders screen selects the
  active location whose radius contains the current position: once on mount, and
  again whenever the app returns to the foreground (`AppState` → `active`,
  throttled 30 s). Permission-gated — never prompts from this screen. True
  transitions while the app is closed need Phase 1 background geofencing.
- **Phase 1+ below** (background geofencing + arrival notifications) builds on 0a/0b
  once the coordinate data and the location-matching helper exist.

Installed so far: `expo-location` (`~57.0.14`); app.json has the `expo-location`
plugin configured foreground-only.

---

## Current state (SDK 57)

- Expo SDK 57, RN 0.86, expo-router 57, React 19. CNG/prebuild (`android/` is
  gitignored and regenerated; no `ios/` yet; no EAS — local `expo run:*` builds).
- `locations` already has `latitude`, `longitude`, `radius_m` (check: `radius_m > 0`).
  The rename migration says outright: *"this concept exists to support GPS-based
  switching between lists."* Nothing populates those columns yet — there is no UI
  to set a location's coordinates.
- `reminders.location_id` already exists; the main screen filters by active location.
- No notification/location infrastructure at all: no `expo-location`,
  `expo-notifications`, `expo-task-manager`, no device/push-token table.
- Settings tab (`app/(tabs)/two.tsx`) is nearly empty — natural home for location
  setup and the geofencing toggle.
- Background geofencing cannot run in Expo Go; the dev build is required (already
  the setup here).

---

## Product decisions

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| 1 | Notification granularity | **One notification per location on arrival** ("3 reminders at Home") | Taps through to that location's filtered list. Avoids a buzz-storm on arrival. |
| 2 | Which reminders count | **All pending at that location, with a per-reminder opt-out** | New column `reminders.notify_on_arrival boolean not null default true`. |
| 3 | Enter / exit / both | **Enter only for v1** | Exit ("you left Work, 2 unfinished") is v2. |
| 4 | Re-notify cadence | **Debounced** — suppress if this location already notified in the last ~2h | Debounce state is device-local (SQLite), not server. |

_(Revisit these if the UX proves wrong in testing.)_

---

## Architecture

- **`lib/geofencing.ts`**
  - Defines the TaskManager task at module top level (must be registered before the
    app mounts — import this module from `app/_layout.tsx`).
  - Task handler: on `Location.GeofencingEventType.Enter`, resolve the region
    identifier → location, query the current user's pending reminders for that
    `location_id` where `notify_on_arrival`, apply the debounce, then fire one
    local notification via `expo-notifications`.
  - `syncGeofences()`: fetch the user's locations that have lat/long/radius set and
    `geofence_enabled`, then `Location.startGeofencingAsync(TASK, regions)` where
    each region is
    `{ identifier: location.id, latitude, longitude, radius, notifyOnEnter: true, notifyOnExit: false }`.
  - Call `syncGeofences()` after sign-in and whenever locations change (Settings
    edits). Also call it on every app open as a belt-and-suspenders re-register.
- **Notification tap** → deep link (`anon://` scheme is already configured) into
  `(tabs)/index` with the arriving location preselected.
- Use **OS region monitoring only** (`startGeofencingAsync`). It is hardware-assisted
  and low-power. Do **not** use `startLocationUpdatesAsync` (continuous GPS, drains
  battery).

---

## Native config (app.json plugins → requires a rebuild)

- `expo-location`: `locationAlwaysAndWhenInUsePermission` copy,
  `isAndroidBackgroundLocationEnabled: true`, `isAndroidForegroundServiceEnabled: true`.
- `expo-notifications`.
- iOS Info.plist: `NSLocationWhenInUseUsageDescription`,
  `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes: [location]`.
- Android manifest: `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `RECEIVE_BOOT_COMPLETED`.
- Then `expo prebuild --clean` + `expo run:android` / `expo run:ios`.

---

## Schema changes

New migration, then regenerate `supabase/schema.sql` (migration → `supabase db reset`
→ `supabase db dump --local --schema public` → commit — the workflow validated in
`0cfff74`).

- `reminders.notify_on_arrival boolean not null default true`
- `locations.geofence_enabled boolean not null default true` (keep coords but mute
  the fence)
- Nothing else server-side. Per-device debounce state lives in local SQLite.

---

## Permissions UX

1. Foreground ("While Using") is requested on the map picker screen the first time
   "Use current location" is tapped; denied → Alert with a deep link to system
   Settings. Radius default 250 ft / 76 m, shown in the locale's unit.
2. **"Notify me at my locations"** master toggle (Phase 1) → drives the
   foreground → background ("Always") permission escalation. iOS prompts for the
   upgrade separately; handle "While Using" / denied gracefully.
3. Settings list shows each place's geofence status (set + radius / none).

---

## Constraints & gotchas

- **iOS caps monitored regions at ~20.** With more located reminders than that,
  nearest-N management is needed. v1: cap at 20 and surface a warning. (Realistic
  usage is 2–5 locations.)
- Geofences survive reboot on both platforms **if** the task stays registered — the
  app-open re-sync covers the edge cases.
- Real testing needs a physical device. Simulators can fake transitions (Android
  emulator location controls; iOS `.gpx` routes).
- First arrival notification can lag 1–2 min — the OS batches transition callbacks.
  Expected, not a bug.

---

## Phased build

1. **Plumbing** — add packages + plugins, prebuild, verify a hardcoded geofence
   fires a local notification on a device.
2. **Location setup UI** in Settings + the `notify_on_arrival` / `geofence_enabled`
   migration.
3. **`syncGeofences()`** wired to sign-in and location edits; real reminder lookup +
   debounce in the task handler.
4. **Permission escalation UX** + denied-state handling.
5. **Polish** — deep-link target, region-cap warning; exit events (v2).

---

## Open questions

- Deep-link target: reuse `(tabs)/index` with a query param for the location, or a
  dedicated arrival screen listing the reminders?
- Should completing a reminder from the notification be possible without opening the
  app (notification actions), or is a tap-through enough for v1?
- `AGENTS.md` still points at v56 docs — fix as part of this work.
