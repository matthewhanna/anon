import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ensureDefaultLocations, type Location } from '@/lib/locations';
import {
  createReminder,
  deleteReminder,
  listReminders,
  setReminderCompleted,
  type Reminder,
} from '@/lib/reminders';

export default function RemindersScreen() {
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme].tint;
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    ensureDefaultLocations().then(({ data, error }) => {
      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }
      setLocations(data ?? []);
      setActiveLocationId((current) => current ?? data?.[0]?.id ?? null);
    });
  }, []);

  const load = useCallback(async (locationId: string) => {
    const { data, error } = await listReminders(locationId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(null);
      setReminders(data ?? []);
    }
  }, []);

  useEffect(() => {
    if (!activeLocationId) {
      return;
    }
    setIsLoading(true);
    load(activeLocationId).finally(() => setIsLoading(false));
  }, [activeLocationId, load]);

  async function handleRefresh() {
    if (!activeLocationId) {
      return;
    }
    setIsRefreshing(true);
    await load(activeLocationId);
    setIsRefreshing(false);
  }

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title || !activeLocationId) {
      return;
    }
    setIsAdding(true);
    const { data, error } = await createReminder(title, activeLocationId);
    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      setNewTitle('');
      setReminders((current) => [data, ...current]);
    }
    setIsAdding(false);
  }

  async function handleToggle(reminder: Reminder) {
    const nextCompleted = !reminder.completed_at;
    setReminders((current) =>
      current.map((item) =>
        item.id === reminder.id
          ? { ...item, completed_at: nextCompleted ? new Date().toISOString() : null }
          : item
      )
    );
    const { error } = await setReminderCompleted(reminder.id, nextCompleted);
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId);
    }
  }

  async function handleDelete(reminder: Reminder) {
    setReminders((current) => current.filter((item) => item.id !== reminder.id));
    const { error } = await deleteReminder(reminder.id);
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId);
    }
  }

  return (
    <View style={styles.container}>
      {locations.length > 0 && (
        <View style={styles.locationRow}>
          {locations.map((location) => {
            const isActive = location.id === activeLocationId;
            return (
              <Pressable
                key={location.id}
                style={[
                  styles.locationButton,
                  { borderColor: tintColor },
                  isActive && { backgroundColor: tintColor },
                ]}
                onPress={() => setActiveLocationId(location.id)}>
                <Text
                  style={[
                    styles.locationButtonText,
                    isActive ? { color: '#fff' } : { color: tintColor },
                  ]}>
                  {location.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { color: Colors[colorScheme].text, borderColor: tintColor }]}
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="New reminder"
          placeholderTextColor="#888"
          editable={!isAdding}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.addButton, { backgroundColor: tintColor }]}
          onPress={handleAdd}
          disabled={isAdding}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={reminders.length === 0 && styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No reminders yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable style={styles.rowMain} onPress={() => handleToggle(item)}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: tintColor },
                    item.completed_at && { backgroundColor: tintColor },
                  ]}
                />
                <Text style={[styles.rowTitle, item.completed_at && styles.rowTitleCompleted]}>
                  {item.title}
                </Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  locationButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  locationButtonText: {
    fontWeight: '600',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  addButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: '#e53e3e',
    marginBottom: 8,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  rowTitle: {
    fontSize: 16,
    flexShrink: 1,
  },
  rowTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  deleteText: {
    color: '#e53e3e',
  },
});
