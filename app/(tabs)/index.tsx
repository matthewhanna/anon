import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  createReminder,
  deleteReminder,
  listReminders,
  setReminderCompleted,
  type Reminder,
} from '@/lib/reminders';

export default function RemindersScreen() {
  const colorScheme = useColorScheme();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await listReminders();
    if (error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(null);
      setReminders(data ?? []);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) {
      return;
    }
    setIsAdding(true);
    const { data, error } = await createReminder(title);
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
      load();
    }
  }

  async function handleDelete(reminder: Reminder) {
    setReminders((current) => current.filter((item) => item.id !== reminder.id));
    const { error } = await deleteReminder(reminder.id);
    if (error) {
      setErrorMessage(error.message);
      load();
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { color: Colors[colorScheme].text, borderColor: Colors[colorScheme].tint }]}
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="New reminder"
          placeholderTextColor="#888"
          editable={!isAdding}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.addButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={handleAdd}
          disabled={isAdding}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
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
                  { borderColor: Colors[colorScheme].tint },
                  item.completed_at && { backgroundColor: Colors[colorScheme].tint },
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
