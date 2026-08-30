import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useLocationHeader } from '@/components/useLocationHeader';
import { useLocationContext } from '@/lib/location-context';
import {
  createProject,
  deleteProject,
  listProjectLocationNames,
  listProjectsForLocation,
  moveProject,
  setProjectLocations,
  type Project,
} from '@/lib/projects';

export default function ProjectsScreen() {
  const scheme = useColorScheme();
  const router = useRouter();
  const { activeLocationId } = useLocationContext();
  useLocationHeader();
  const accent = Colors[scheme].accent;
  const border = scheme === 'dark' ? '#2a2a2a' : '#e2e2e2';
  const muted = scheme === 'dark' ? '#9aa0a6' : '#6b7280';

  const [projects, setProjects] = useState<Project[]>([]);
  const [locNames, setLocNames] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    if (!activeLocationId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    Promise.all([listProjectsForLocation(activeLocationId), listProjectLocationNames()]).then(
      ([res, names]) => {
        if (res.error) setError(res.error.message);
        else {
          setError(null);
          setProjects(res.data ?? []);
        }
        setLocNames(names);
        setLoading(false);
      }
    );
  }, [activeLocationId]);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function reorder(id: string, direction: 'up' | 'down') {
    const result = await moveProject(projects, id, direction);
    if (result && activeLocationId) {
      const { data } = await listProjectsForLocation(activeLocationId);
      setProjects(data ?? []);
    }
  }

  async function add() {
    const name = newName.trim();
    if (!name || adding || !activeLocationId) return;
    setAdding(true);
    const { data, error: addError } = await createProject(name);
    if (addError) setError(addError.message);
    else if (data) {
      await setProjectLocations(data.id, [activeLocationId]);
      setProjects((prev) => [...prev, data]);
      setLocNames((prev) => ({ ...prev, [data.id]: [] }));
      setNewName('');
    }
    setAdding(false);
  }

  function confirmDelete(p: Project) {
    Alert.alert(`Delete "${p.name}"?`, 'Its tasks are kept, just unassigned from the project.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: delError } = await deleteProject(p.id);
          if (delError) setError(delError.message);
          else setProjects((prev) => prev.filter((x) => x.id !== p.id));
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.hint, { color: muted }]}>
        Projects assigned to the location in the header. New projects are added here; open one to
        assign it more locations. Deleting a project keeps its tasks.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} />
      ) : (
        projects.map((p, i) => (
          <View key={p.id} style={[styles.row, { borderColor: border }]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{p.name}</Text>
              <Text style={[styles.rowSub, { color: muted }]}>
                {locNames[p.id]?.length ? locNames[p.id].join(' · ') : 'No locations'}
              </Text>
            </View>
            <Pressable disabled={i === 0} onPress={() => reorder(p.id, 'up')} style={styles.iconBtn}>
              <Text style={{ color: i === 0 ? border : accent, fontSize: 18 }}>↑</Text>
            </Pressable>
            <Pressable
              disabled={i === projects.length - 1}
              onPress={() => reorder(p.id, 'down')}
              style={styles.iconBtn}
            >
              <Text style={{ color: i === projects.length - 1 ? border : accent, fontSize: 18 }}>↓</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/project/[id]', params: { id: p.id } })}
              style={styles.rowBtn}
            >
              <Text style={{ color: accent }}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => confirmDelete(p)} style={styles.rowBtn}>
              <Text style={{ color: '#e53e3e' }}>Delete</Text>
            </Pressable>
          </View>
        ))
      )}

      <View style={[styles.addRow, { borderColor: border }]}>
        <TextInput
          placeholder="Add a project…"
          placeholderTextColor={muted}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={add}
          style={[styles.addInput, { color: Colors[scheme].text }]}
        />
        <Pressable onPress={add} disabled={!newName.trim() || adding} style={styles.addBtn}>
          <Text style={{ color: accent, fontWeight: '600' }}>Add</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12 },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  rowBtn: { paddingVertical: 6, paddingHorizontal: 8 },
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
});
