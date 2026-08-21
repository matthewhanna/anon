import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { listFamilyMembers, type FamilyMember } from '@/lib/family-members';
import { listGroups, type Group } from '@/lib/groups';
import { ensureDefaultLocations, type Location } from '@/lib/locations';
import { parseScheduleInput } from '@/lib/parse-schedule';
import { formatDueAt, formatRecurrence, nextOccurrence } from '@/lib/recurrence';
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listReminders,
  setReminderAssignee,
  uncompleteReminder,
  updateReminderSchedule,
  type AssigneeTarget,
  type Reminder,
} from '@/lib/reminders';
import { createRoom, listRooms, type Room } from '@/lib/rooms';

function assigneeKey(reminder: Reminder): string {
  return reminder.assignee_id ? `member:${reminder.assignee_id}` : `group:${reminder.assignee_group_id}`;
}

function parseAssigneeKey(key: string): AssigneeTarget {
  const [type, id] = key.split(':');
  return type === 'group' ? { type: 'group', id } : { type: 'member', id };
}

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
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scheduleTexts, setScheduleTexts] = useState<Record<string, string>>({});
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string | null>>({});
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string>>({});

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
    listFamilyMembers().then(({ data, error }) => {
      if (!error) {
        setFamilyMembers(data ?? []);
      }
    });
    listGroups().then(({ data, error }) => {
      if (!error) {
        setGroups(data ?? []);
      }
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

  async function handleAssign(reminder: Reminder, target: AssigneeTarget) {
    setReminders((current) =>
      current.map((item) =>
        item.id === reminder.id
          ? {
              ...item,
              assignee_id: target.type === 'member' ? target.id : null,
              assignee_group_id: target.type === 'group' ? target.id : null,
            }
          : item
      )
    );
    const { error } = await setReminderAssignee(reminder.id, target);
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId, activeRoomId);
    }
  }

  async function handleDelegate(reminder: Reminder) {
    const draft = assigneeDrafts[reminder.id];
    if (!draft) {
      return;
    }
    await handleAssign(reminder, parseAssigneeKey(draft));
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
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <View style={styles.headerRow}>
            <View style={styles.colDone} />
            <View style={styles.colTask} />
            <Text style={[styles.headerCell, styles.colDue]}>Due</Text>
            <Text style={[styles.headerCell, styles.colAssignee]}>Assignee</Text>
            <View style={styles.colDelegate} />
            <View style={styles.colTrash} />
          </View>
          <FlatList
            data={reminders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={reminders.length === 0 && styles.emptyContainer}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={<Text style={styles.emptyText}>No reminders yet.</Text>}
            renderItem={({ item }) => {
              const recurrenceLabel = formatRecurrence(item.recurrence_freq, item.recurrence_weekday);
              const scheduleError = scheduleErrors[item.id];
              return (
                <View style={styles.row}>
                  <View style={[styles.cell, styles.colDone]}>
                    <Pressable onPress={() => handleToggle(item)} hitSlop={8}>
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: tintColor },
                          item.completed_at && { backgroundColor: tintColor },
                        ]}
                      />
                    </Pressable>
                  </View>
                  <View style={[styles.cell, styles.colTask]}>
                    <Pressable onPress={() => router.push(`/reminder/${item.id}`)} style={styles.taskTitleTouch}>
                      <Text style={[styles.rowTitle, item.completed_at && styles.rowTitleCompleted]}>
                        {item.title}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={[styles.cell, styles.colDue]}>
                    <TextInput
                      style={[styles.dateInput, { color: Colors[colorScheme].text, borderColor: tintColor }]}
                      value={scheduleTexts[item.id] ?? formatDueAt(item.due_at) ?? ''}
                      onChangeText={(text) => setScheduleTexts((current) => ({ ...current, [item.id]: text }))}
                      onFocus={() => {
                        if (scheduleTexts[item.id] === undefined) {
                          setScheduleTexts((current) => ({ ...current, [item.id]: '' }));
                        }
                      }}
                      placeholder="next Tue, every Tue 11a…"
                      placeholderTextColor="#888"
                      onSubmitEditing={() => handleQuickSchedule(item)}
                      returnKeyType="done"
                    />
                    {recurrenceLabel ? <Text style={styles.rowMeta}>{recurrenceLabel}</Text> : null}
                    {scheduleError ? <Text style={styles.error}>{scheduleError}</Text> : null}
                  </View>
                  <View style={[styles.cell, styles.colAssignee]}>
                    <Picker
                      selectedValue={assigneeDrafts[item.id] ?? assigneeKey(item)}
                      onValueChange={(value) =>
                        setAssigneeDrafts((current) => ({ ...current, [item.id]: String(value) }))
                      }
                      style={styles.assigneePicker}>
                      {familyMembers.map((member) => (
                        <Picker.Item key={member.id} label={member.name} value={`member:${member.id}`} />
                      ))}
                      {groups.map((group) => (
                        <Picker.Item key={group.id} label={`Group: ${group.name}`} value={`group:${group.id}`} />
                      ))}
                    </Picker>
                  </View>
                  <View style={[styles.cell, styles.colDelegate]}>
                    <Pressable
                      style={[styles.delegateButton, { backgroundColor: tintColor }]}
                      onPress={() => handleDelegate(item)}>
                      <Text style={styles.delegateButtonText}>Delegate</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.cell, styles.colTrash]}>
                    <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                      <Text style={styles.trashIcon}>🗑</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              <View style={styles.row}>
                <View style={[styles.cell, styles.colDone]} />
                <View style={[styles.cell, styles.colTask]}>
                  <TextInput
                    style={[styles.rowTitle, { color: Colors[colorScheme].text }]}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder="New reminder"
                    placeholderTextColor="#888"
                    editable={!isAdding}
                    onSubmitEditing={handleAdd}
                    returnKeyType="done"
                  />
                </View>
                <View style={[styles.cell, styles.colDue]} />
                <View style={[styles.cell, styles.colAssignee]} />
                <View style={[styles.cell, styles.colDelegate]} />
                <View style={[styles.cell, styles.colTrash]} />
              </View>
            }
          />
        </>
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
  headerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#8884',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  cell: {
    justifyContent: 'center',
  },
  colDone: {
    width: 28,
    alignItems: 'center',
  },
  colTask: {
    flex: 3,
    minWidth: 110,
  },
  colDue: {
    flex: 2,
    minWidth: 130,
  },
  colAssignee: {
    width: 150,
  },
  colDelegate: {
    width: 90,
  },
  colTrash: {
    width: 32,
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  taskTitleTouch: {
    flexShrink: 1,
  },
  rowTitle: {
    fontSize: 16,
    flexShrink: 1,
  },
  rowTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  smallQuickInput: {
    width: 130,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  rowMeta: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  assigneePicker: {
    width: '100%',
  },
  delegateButton: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  delegateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  trashIcon: {
    fontSize: 18,
  },
});
