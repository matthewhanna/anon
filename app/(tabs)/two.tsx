import { useLocales } from 'expo-localization';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth-context';
import {
  DEFAULT_RADIUS_M,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
  clampRadiusM,
  getCurrentCoords,
  getForegroundPermission,
  requestForegroundPermission,
  type LocationPermission,
} from '@/lib/location';
import {
  clearLocationGeo,
  createLocation,
  deleteLocation,
  listLocations,
  renameLocation,
  setLocationGeo,
  type Location,
} from '@/lib/locations';
import {
  displayToMeters,
  formatRadius,
  metersToDisplay,
  radiusUnitLabel,
  unitSystemFrom,
} from '@/lib/units';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const scheme = useColorScheme();
  const tint = Colors[scheme].tint;
  const accent = Colors[scheme].accent;
  const accentText = Colors[scheme].accentText;
  const system = unitSystemFrom(useLocales()[0]?.measurementSystem);
  const unit = radiusUnitLabel(system);

  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<LocationPermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [radiusDrafts, setRadiusDrafts] = useState<Record<string, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    getForegroundPermission().then(setPermission);
    listLocations().then(({ data, error: listError }) => {
      if (listError) setError(listError.message);
      else setLocations(data ?? []);
      setIsLoading(false);
    });
  }, []);

  // Draft strings and the input are in the user's display unit; storage is meters.
  const radiusInputFor = (loc: Location) =>
    radiusDrafts[loc.id] ?? String(metersToDisplay(loc.radius_m ?? DEFAULT_RADIUS_M, system));
  const radiusMetersFor = (loc: Location) =>
    clampRadiusM(displayToMeters(Number(radiusInputFor(loc)), system));

  async function ensurePermission(): Promise<boolean> {
    let state = permission ?? (await getForegroundPermission());
    if (state !== 'granted') state = await requestForegroundPermission();
    setPermission(state);
    if (state !== 'granted') {
      Alert.alert(
        'Location permission needed',
        'Anon needs location access to use your current position. Enable it in Settings.',
        [{ text: 'Not now' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
      );
      return false;
    }
    return true;
  }

  function replace(loc: Location) {
    setLocations((prev) => prev.map((l) => (l.id === loc.id ? loc : l)));
  }

  function setRadiusDraftMeters(id: string, meters: number) {
    setRadiusDrafts((d) => ({ ...d, [id]: String(metersToDisplay(meters, system)) }));
  }

  async function captureCurrent(loc: Location) {
    setError(null);
    if (!(await ensurePermission())) return;
    setBusyId(loc.id);
    try {
      const coords = await getCurrentCoords();
      const radius = radiusMetersFor(loc);
      const { data, error: geoError } = await setLocationGeo(loc.id, coords, radius);
      if (geoError) setError(geoError.message);
      else if (data) {
        replace(data);
        setRadiusDraftMeters(loc.id, data.radius_m ?? radius);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read location');
    } finally {
      setBusyId(null);
    }
  }

  async function commitRadius(loc: Location) {
    const raw = radiusDrafts[loc.id];
    if (raw == null) return;
    const currentDisplay = metersToDisplay(loc.radius_m ?? DEFAULT_RADIUS_M, system);
    const meters = clampRadiusM(displayToMeters(Number(raw), system));
    setRadiusDraftMeters(loc.id, meters);
    if (loc.latitude == null || loc.longitude == null) return;
    if (Number(raw) === currentDisplay || meters === loc.radius_m) return;
    const { data, error: geoError } = await setLocationGeo(
      loc.id,
      { latitude: loc.latitude, longitude: loc.longitude },
      meters
    );
    if (geoError) setError(geoError.message);
    else if (data) replace(data);
  }

  async function clearGeo(loc: Location) {
    const { data, error: geoError } = await clearLocationGeo(loc.id);
    if (geoError) setError(geoError.message);
    else if (data) {
      replace(data);
      setRadiusDraftMeters(loc.id, DEFAULT_RADIUS_M);
    }
  }

  async function commitName(loc: Location) {
    const next = (nameDrafts[loc.id] ?? loc.name).trim();
    setEditingNameId(null);
    if (!next || next === loc.name) return;
    const { data, error: renameError } = await renameLocation(loc.id, next);
    if (renameError) setError(renameError.message);
    else if (data) replace(data);
  }

  function confirmDelete(loc: Location) {
    Alert.alert(
      `Delete "${loc.name}"?`,
      'Its rooms are deleted too, and its reminders are unassigned (not deleted).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error: delError } = await deleteLocation(loc.id);
            if (delError) setError(delError.message);
            else setLocations((prev) => prev.filter((l) => l.id !== loc.id));
          },
        },
      ]
    );
  }

  async function addLocation() {
    const name = newName.trim();
    if (!name || isAdding) return;
    setIsAdding(true);
    const { data, error: addError } = await createLocation(name);
    if (addError) setError(addError.message);
    else if (data) {
      setLocations((prev) => [...prev, data]);
      setNewName('');
    }
    setIsAdding(false);
  }

  const borderColor = scheme === 'dark' ? '#2a2a2a' : '#e2e2e2';
  const mutedColor = scheme === 'dark' ? '#9aa0a6' : '#6b7280';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Locations</Text>
      <Text style={[styles.sectionHint, { color: mutedColor }]}>
        Give a place a name and a geofence (a point plus a radius). When you open Anon, it
        switches to the list for the place you're in.
      </Text>

      {permission === 'denied' ? (
        <Pressable onPress={() => Linking.openSettings()} style={[styles.banner, { borderColor: tint }]}>
          <Text style={{ color: tint }}>Location access is off — tap to open Settings</Text>
        </Pressable>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} />
      ) : (
        locations.map((loc) => {
          const isSet = loc.latitude != null && loc.longitude != null;
          return (
            <View key={loc.id} style={[styles.card, { borderColor }]}>
              {editingNameId === loc.id ? (
                <TextInput
                  autoFocus
                  defaultValue={loc.name}
                  onChangeText={(t) => setNameDrafts((d) => ({ ...d, [loc.id]: t }))}
                  onBlur={() => commitName(loc)}
                  onSubmitEditing={() => commitName(loc)}
                  style={[styles.nameInput, { color: Colors[scheme].text, borderColor }]}
                />
              ) : (
                <Pressable onPress={() => setEditingNameId(loc.id)}>
                  <Text style={styles.cardTitle}>{loc.name}</Text>
                </Pressable>
              )}

              <Text style={[styles.status, { color: mutedColor }]}>
                {isSet
                  ? `${loc.latitude!.toFixed(5)}, ${loc.longitude!.toFixed(5)} · ±${formatRadius(
                      loc.radius_m ?? DEFAULT_RADIUS_M,
                      system
                    )}`
                  : 'No geofence set'}
              </Text>

              <View style={styles.radiusRow}>
                <Text style={{ color: mutedColor }}>Radius ({unit})</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={radiusInputFor(loc)}
                  onChangeText={(t) => setRadiusDrafts((d) => ({ ...d, [loc.id]: t.replace(/[^0-9]/g, '') }))}
                  onBlur={() => commitRadius(loc)}
                  style={[styles.radiusInput, { color: Colors[scheme].text, borderColor }]}
                />
                <Text style={[styles.rangeHint, { color: mutedColor }]}>
                  {metersToDisplay(MIN_RADIUS_M, system)}–{metersToDisplay(MAX_RADIUS_M, system)}
                </Text>
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => captureCurrent(loc)}
                  disabled={busyId === loc.id}
                  style={[styles.btn, { backgroundColor: accent }]}
                >
                  {busyId === loc.id ? (
                    <ActivityIndicator color={accentText} />
                  ) : (
                    <Text style={[styles.btnText, { color: accentText }]}>
                      {isSet ? 'Update to current location' : 'Use current location'}
                    </Text>
                  )}
                </Pressable>
                {isSet ? (
                  <Pressable onPress={() => clearGeo(loc)} style={[styles.btnGhost, { borderColor }]}>
                    <Text style={{ color: mutedColor }}>Clear</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => confirmDelete(loc)} style={styles.btnGhost}>
                  <Text style={{ color: '#e53e3e' }}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      <View style={[styles.addRow, { borderColor }]}>
        <TextInput
          placeholder="Add a location…"
          placeholderTextColor={mutedColor}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={addLocation}
          style={[styles.addInput, { color: Colors[scheme].text }]}
        />
        <Pressable onPress={addLocation} disabled={!newName.trim() || isAdding} style={styles.addBtn}>
          <Text style={{ color: tint, fontWeight: '600' }}>Add</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={[styles.sectionTitle, { marginTop: 36 }]}>Account</Text>
      <Text style={[styles.sectionHint, { color: mutedColor }]}>Signed in as {session?.user.email}</Text>
      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  sectionHint: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  banner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  nameInput: { fontSize: 16, fontWeight: '600', borderBottomWidth: 1, paddingVertical: 2 },
  status: { fontSize: 12 },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radiusInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 76,
    textAlign: 'right',
  },
  rangeHint: { fontSize: 11 },
  cardActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  btn: { borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14 },
  btnText: { fontWeight: '600' },
  btnGhost: { borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: 'transparent' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 12,
    marginTop: 4,
  },
  addInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
  addBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  error: { color: '#e53e3e', marginTop: 12 },
  signOut: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#e53e3e',
    marginTop: 12,
  },
  signOutText: { color: '#fff', fontWeight: '600' },
});
