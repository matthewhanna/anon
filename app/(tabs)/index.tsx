import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ensureDefaultLocations, type Location } from '@/lib/locations';
import { parseScheduleInput } from '@/lib/parse-schedule';
import { formatDueAt, formatRecurrence, nextOccurrence } from '@/lib/recurrence';
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listReminders,
  setReminderDueAt,
  uncompleteReminder,
  updateReminderSchedule,
  type Reminder,
} from '@/lib/reminders';
import { createRoom, listRooms, type Room } from '@/lib/rooms';

export default function RemindersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme].tint;
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scheduleTexts, setScheduleTexts] = useState<Record<string, string>>({});
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string | null>>({});

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

  const load = useCallback(async (locationId: string, roomId: string | null) => {
    const { data, error } = await listReminders(locationId, roomId);
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
    setActiveRoomId(null);
    setIsAddingRoom(false);
    setNewRoomName('');
    listRooms(activeLocationId).then(({ data, error }) => {
      if (error) {
        setErrorMessage(error.message);
      } else {
        setRooms(data ?? []);
      }
    });
  }, [activeLocationId]);

  useEffect(() => {
    if (!activeLocationId) {
      return;
    }
    setIsLoading(true);
    load(activeLocationId, activeRoomId).finally(() => setIsLoading(false));
  }, [activeLocationId, activeRoomId, load]);

  async function handleRefresh() {
    if (!activeLocationId) {
      return;
    }
    setIsRefreshing(true);
    await load(activeLocationId, activeRoomId);
    setIsRefreshing(false);
  }

  async function handleAddRoom() {
    const name = newRoomName.trim();
    if (!name || !activeLocationId) {
      return;
    }
    const { data, error } = await createRoom(activeLocationId, name);
    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      setRooms((current) => [...current, data]);
      setActiveRoomId(data.id);
      setNewRoomName('');
      setIsAddingRoom(false);
    }
  }

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title || !activeLocationId) {
      return;
    }
    setIsAdding(true);
    const { data, error } = await createReminder(title, activeLocationId, activeRoomId);
    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      setNewTitle('');
      setReminders((current) => [data, ...current]);
    }
    setIsAdding(false);
  }

  async function handleToggle(reminder: Reminder) {
    const isRecurring = Boolean(reminder.recurrence_freq && reminder.due_at);
    const nextCompleted = !reminder.completed_at;

    if (isRecurring) {
      const next = nextOccurrence(new Date(reminder.due_at as string), reminder.recurrence_freq!, reminder.recurrence_weekday);
      setReminders((current) =>
        current.map((item) => (item.id === reminder.id ? { ...item, due_at: next.toISOString() } : item))
      );
    } else {
      setReminders((current) =>
        current.map((item) =>
          item.id === reminder.id
            ? { ...item, completed_at: nextCompleted ? new Date().toISOString() : null }
            : item
        )
      );
    }

    const { error } = isRecurring || nextCompleted
      ? await completeReminder(reminder)
      : await uncompleteReminder(reminder.id);

    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId, activeRoomId);
    }
  }

  async function handleClearDueAt(reminder: Reminder) {
    setReminders((current) =>
      current.map((item) =>
        item.id === reminder.id
          ? { ...item, due_at: null, recurrence_freq: null, recurrence_weekday: null }
          : item
      )
    );
    const { error } = await setReminderDueAt(reminder.id, null);
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId, activeRoomId);
    }
  }

  async function handleQuickSchedule(reminder: Reminder) {
    const text = scheduleTexts[reminder.id] ?? '';
    const parsed = parseScheduleInput(text);
    if (!parsed) {
      setScheduleErrors((current) => ({
        ...current,
        [reminder.id]: 'Couldn\'t understand that — try "8/25/26", "next Tue", or "every Tue at 11a".',
      }));
      return;
    }
    setScheduleErrors((current) => ({ ...current, [reminder.id]: null }));
    setScheduleTexts((current) => ({ ...current, [reminder.id]: '' }));
    setReminders((current) =>
      current.map((item) =>
        item.id === reminder.id
          ? {
              ...item,
              due_at: parsed.dueAt.toISOString(),
              recurrence_freq: parsed.recurrenceFreq,
              recurrence_weekday: parsed.recurrenceWeekday,
            }
          : item
      )
    );
    const { error } = await updateReminderSchedule(reminder.id, {
      due_at: parsed.dueAt.toISOString(),
      recurrence_freq: parsed.recurrenceFreq,
      recurrence_weekday: parsed.recurrenceWeekday,
    });
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId, activeRoomId);
    }
  }

  async function handleDelete(reminder: Reminder) {
    setReminders((current) => current.filter((item) => item.id !== reminder.id));
    const { error } = await deleteReminder(reminder.id);
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId, activeRoomId);
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
      {activeLocationId && (
        <View style={styles.roomRow}>
          {rooms.length > 0 && (
            <Pressable
              style={[styles.roomButton, { borderColor: tintColor }, activeRoomId === null && { backgroundColor: tintColor }]}
              onPress={() => setActiveRoomId(null)}>
              <Text style={activeRoomId === null ? { color: '#fff' } : { color: tintColor }}>All</Text>
            </Pressable>
          )}
          {rooms.map((room) => {
            const isActive = room.id === activeRoomId;
            return (
              <Pressable
                key={room.id}
                style={[styles.roomButton, { borderColor: tintColor }, isActive && { backgroundColor: tintColor }]}
                onPress={() => setActiveRoomId(room.id)}>
                <Text style={isActive ? { color: '#fff' } : { color: tintColor }}>{room.name}</Text>
              </Pressable>
            );
          })}
          {isAddingRoom ? (
            <TextInput
              style={[styles.smallQuickInput, { color: Colors[colorScheme].text, borderColor: tintColor }]}
              value={newRoomName}
              onChangeText={setNewRoomName}
              placeholder="Room name"
              placeholderTextColor="#888"
              onSubmitEditing={handleAddRoom}
              onBlur={() => {
                if (!newRoomName.trim()) setIsAddingRoom(false);
              }}
              returnKeyType="done"
              autoFocus
            />
          ) : (
            <Pressable style={[styles.roomButton, { borderColor: tintColor }]} onPress={() => setIsAddingRoom(true)}>
              <Text style={{ color: tintColor }}>+ Room</Text>
            </Pressable>
          )}
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
          renderItem={({ item }) => {
            const dueLabel = formatDueAt(item.due_at);
            const recurrenceLabel = formatRecurrence(item.recurrence_freq, item.recurrence_weekday);
            const scheduleError = scheduleErrors[item.id];
            return (
              <View style={styles.row}>
                <Pressable onPress={() => handleToggle(item)} hitSlop={8} style={styles.checkboxTouch}>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: tintColor },
                      item.completed_at && { backgroundColor: tintColor },
                    ]}
                  />
                </Pressable>
                <View style={styles.rowMain}>
                  <Pressable onPress={() => router.push(`/reminder/${item.id}`)}>
                    <Text style={[styles.rowTitle, item.completed_at && styles.rowTitleCompleted]}>
                      {item.title}
                    </Text>
                  </Pressable>
                  <View style={styles.metaRow}>
                    <Text style={styles.rowMeta}>{dueLabel ?? 'No due date'}</Text>
                    <TextInput
                      style={[styles.smallQuickInput, { color: Colors[colorScheme].text, borderColor: tintColor }]}
                      value={scheduleTexts[item.id] ?? ''}
                      onChangeText={(text) => setScheduleTexts((current) => ({ ...current, [item.id]: text }))}
                      placeholder="next Tue, every Tue 11a…"
                      placeholderTextColor="#888"
                      onSubmitEditing={() => handleQuickSchedule(item)}
                      returnKeyType="done"
                    />
                    {item.due_at && (
                      <Pressable onPress={() => handleClearDueAt(item)} hitSlop={4}>
                        <Text style={styles.link}>Clear</Text>
                      </Pressable>
                    )}
                    {recurrenceLabel ? <Text style={styles.rowMeta}>{recurrenceLabel}</Text> : null}
                  </View>
                  {scheduleError ? <Text style={styles.error}>{scheduleError}</Text> : null}
                </View>
                <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            );
          }}
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
  roomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  roomButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
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
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  checkboxTouch: {
    paddingTop: 2,
  },
  rowMain: {
    flex: 1,
    gap: 2,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowMeta: {
    fontSize: 13,
    opacity: 0.6,
  },
  smallQuickInput: {
    width: 130,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  link: {
    fontSize: 13,
    textDecorationLine: 'underline',
    opacity: 0.7,
  },
  deleteText: {
    color: '#e53e3e',
  },
});
