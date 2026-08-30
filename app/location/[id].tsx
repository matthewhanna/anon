import Slider from '@react-native-community/slider';
import { useLocales } from 'expo-localization';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, TextInput } from 'react-native';

import MapPicker from '@/components/MapPicker';
import type { MapPickerHandle } from '@/components/MapPicker.types';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  DEFAULT_RADIUS_M,
  clampRadiusM,
  getCurrentCoords,
  getForegroundPermission,
  requestForegroundPermission,
  type Coords,
} from '@/lib/location';
import {
  clearLocationGeo,
  createLocation,
  getLocation,
  renameLocation,
  setLocationGeo,
} from '@/lib/locations';
import {
  displayToMeters,
  formatRadiusDisplay,
  metersToDisplay,
  radiusSliderConfig,
  unitSystemFrom,
} from '@/lib/units';

export default function LocationEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const scheme = useColorScheme();
  const accent = Colors[scheme].accent;
  const system = unitSystemFrom(useLocales()[0]?.measurementSystem);
  const mapRef = useRef<MapPickerHandle>(null);

  const slider = radiusSliderConfig(system);
  const [name, setName] = useState('');
  const [point, setPoint] = useState<Coords | null>(null);
  // Slider works in the display unit; meters is derived for storage/circle/map.
  const [radiusDisplay, setRadiusDisplay] = useState(() => metersToDisplay(DEFAULT_RADIUS_M, system));
  const radiusM = displayToMeters(radiusDisplay, system);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let startPoint: Coords | null = null;
      let startRadius = DEFAULT_RADIUS_M;

      if (!isNew) {
        const { data, error: loadError } = await getLocation(id);
        if (loadError) setError(loadError.message);
        else if (data) {
          setName(data.name);
          startRadius = data.radius_m ?? DEFAULT_RADIUS_M;
          if (data.latitude != null && data.longitude != null) {
            startPoint = { latitude: data.latitude, longitude: data.longitude };
          }
        }
      }

      if (!startPoint && (await getForegroundPermission()) === 'granted') {
        try {
          startPoint = await getCurrentCoords();
        } catch {
          // best effort — fall through to the wide fallback region
        }
      }

      setRadiusDisplay(metersToDisplay(startRadius, system));
      setPoint(startPoint);
      setLoading(false);
    })();
  }, [id, isNew]);

  async function useCurrentLocation() {
    setError(null);
    let perm = await getForegroundPermission();
    if (perm !== 'granted') perm = await requestForegroundPermission();
    if (perm !== 'granted') {
      Alert.alert(
        'Location permission needed',
        'Enable location access in Settings to drop a pin where you are.',
        [{ text: 'Not now' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]
      );
      return;
    }
    setLocating(true);
    try {
      const c = await getCurrentCoords();
      setPoint(c);
      mapRef.current?.centerOn(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read location');
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give this place a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let locId = id;
      if (isNew) {
        const { data, error: createError } = await createLocation(trimmed);
        if (createError || !data) throw new Error(createError?.message ?? 'Could not create location');
        locId = data.id;
      } else {
        const { error: renameError } = await renameLocation(id, trimmed);
        if (renameError) throw new Error(renameError.message);
      }

      if (point) {
        const { error: geoError } = await setLocationGeo(locId, point, clampRadiusM(radiusM));
        if (geoError) throw new Error(geoError.message);
      } else if (!isNew) {
        const { error: clearError } = await clearLocationGeo(id);
        if (clearError) throw new Error(clearError.message);
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const borderColor = scheme === 'dark' ? '#2a2a2a' : '#e2e2e2';
  const mutedColor = scheme === 'dark' ? '#9aa0a6' : '#6b7280';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: isNew ? 'New location' : 'Edit location' }} />

      <TextInput
        placeholder="Location name"
        placeholderTextColor={mutedColor}
        value={name}
        onChangeText={setName}
        style={[styles.nameInput, { color: Colors[scheme].text, borderColor }]}
      />

      <MapPicker
        ref={mapRef}
        point={point}
        radiusM={radiusM}
        strokeColor={accent}
        onPointChange={setPoint}
        style={styles.map}
      />

      <View style={styles.controls}>
        {point ? (
          <>
            <View style={styles.radiusHeader}>
              <Text style={{ color: mutedColor }}>Radius</Text>
              <Text style={styles.radiusValue}>{formatRadiusDisplay(radiusDisplay, system)}</Text>
            </View>
            <Slider
              minimumValue={slider.min}
              maximumValue={slider.max}
              step={slider.step}
              value={radiusDisplay}
              onValueChange={setRadiusDisplay}
              minimumTrackTintColor={accent}
            />
          </>
        ) : (
          <Text style={[styles.hint, { color: mutedColor }]}>
            Tap the map, or use your current location, to set the point.
          </Text>
        )}

        <View style={styles.actionRow}>
          <Pressable
            onPress={useCurrentLocation}
            disabled={locating}
            style={[styles.ghostBtn, { borderColor }]}>
            {locating ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: accent }}>Use current location</Text>
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: accent }]}>
          {saving ? (
            <ActivityIndicator color={Colors[scheme].accentText} />
          ) : (
            <Text style={[styles.saveText, { color: Colors[scheme].accentText }]}>Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nameInput: {
    borderBottomWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  map: { flex: 1 },
  controls: { padding: 16, gap: 10 },
  radiusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  radiusValue: { fontWeight: '600' },
  hint: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  ghostBtn: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  error: { color: '#e53e3e' },
  saveBtn: { borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 2 },
  saveText: { fontWeight: '600', fontSize: 16 },
});
