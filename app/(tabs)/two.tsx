import { useLocales } from 'expo-localization';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_RADIUS_M } from '@/lib/location';
import { deleteLocation, listLocations, type Location } from '@/lib/locations';
import { formatRadius, unitSystemFrom } from '@/lib/units';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const scheme = useColorScheme();
  const router = useRouter();
  const accent = Colors[scheme].accent;
  const system = unitSystemFrom(useLocales()[0]?.measurementSystem);

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listLocations().then(({ data, error: listError }) => {
      if (listError) setError(listError.message);
      else {
        setError(null);
        setLocations(data ?? []);
      }
      setLoading(false);
    });
  }, []);

  // Reload on focus so edits made on the picker screen show when we return.
  useFocusEffect(useCallback(() => void load(), [load]));

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

  const borderColor = scheme === 'dark' ? '#2a2a2a' : '#e2e2e2';
  const mutedColor = scheme === 'dark' ? '#9aa0a6' : '#6b7280';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Locations</Text>
      <Text style={[styles.sectionHint, { color: mutedColor }]}>
        A named place with a geofence. When you open Anon it switches to the list for the place
        you're in.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} />
      ) : (
        locations.map((loc) => {
          const isSet = loc.latitude != null && loc.longitude != null;
          return (
            <View key={loc.id} style={[styles.row, { borderColor }]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{loc.name}</Text>
                <Text style={[styles.rowSub, { color: mutedColor }]}>
                  {isSet ? `Geofence · ${formatRadius(loc.radius_m ?? DEFAULT_RADIUS_M, system)}` : 'No geofence'}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/location/[id]', params: { id: loc.id } })}
                style={styles.rowBtn}
              >
                <Text style={{ color: accent }}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(loc)} style={styles.rowBtn}>
                <Text style={{ color: '#e53e3e' }}>Delete</Text>
              </Pressable>
            </View>
          );
        })
      )}

      <Pressable
        onPress={() => router.push({ pathname: '/location/[id]', params: { id: 'new' } })}
        style={[styles.addBtn, { backgroundColor: accent }]}
      >
        <Text style={[styles.addText, { color: Colors[scheme].accentText }]}>Add location</Text>
      </Pressable>

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12 },
  rowBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  addBtn: { borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  addText: { fontWeight: '600', fontSize: 15 },
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
