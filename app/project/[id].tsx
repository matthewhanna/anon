import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import LocationMultiSelect from '@/components/LocationMultiSelect';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { listLocations, type Location } from '@/lib/locations';
import {
  deleteProject,
  getProjectLocationIds,
  listProjects,
  renameProject,
  setProjectLocations,
} from '@/lib/projects';

export default function ProjectEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const accent = Colors[scheme].accent;
  const border = scheme === 'dark' ? '#2a2a2a' : '#e2e2e2';
  const muted = scheme === 'dark' ? '#9aa0a6' : '#6b7280';

  const [name, setName] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: locs }, { data: linkIds }, { data: projs }] = await Promise.all([
        listLocations(),
        getProjectLocationIds(id),
        listProjects(),
      ]);
      setLocations(locs ?? []);
      setSelectedIds(linkIds ?? []);
      setName(projs?.find((p) => p.id === id)?.name ?? '');
      setLoading(false);
    })();
  }, [id]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give this project a name.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: renameError } = await renameProject(id, trimmed);
    if (renameError) {
      setError(renameError.message);
      setSaving(false);
      return;
    }
    const { error: locError } = await setProjectLocations(id, selectedIds);
    if (locError) {
      setError(locError.message);
      setSaving(false);
      return;
    }
    router.back();
  }

  function confirmDelete() {
    Alert.alert(`Delete "${name}"?`, 'Its tasks are kept, just unassigned from the project.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: delError } = await deleteProject(id);
          if (delError) setError(delError.message);
          else router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Edit project' }} />

      <Text style={[styles.label, { color: muted }]}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={[styles.input, { color: Colors[scheme].text, borderColor: border }]}
      />

      <Text style={[styles.label, { color: muted, marginTop: 20 }]}>Locations</Text>
      <LocationMultiSelect locations={locations} selectedIds={selectedIds} onChange={setSelectedIds} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: accent }]}>
        {saving ? (
          <ActivityIndicator color={Colors[scheme].accentText} />
        ) : (
          <Text style={[styles.saveText, { color: Colors[scheme].accentText }]}>Save</Text>
        )}
      </Pressable>

      <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
        <Text style={{ color: '#e53e3e' }}>Delete project</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 48 },
  label: { fontSize: 13, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  error: { color: '#e53e3e', marginTop: 16 },
  saveBtn: { borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 28 },
  saveText: { fontWeight: '600', fontSize: 16 },
  deleteBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
});
