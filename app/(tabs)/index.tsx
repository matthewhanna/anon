import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';

import AssigneeSelect from '@/components/AssigneeSelect';
import DraggableRow from '@/components/DraggableRow';
import DropZone from '@/components/DropZone';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getCurrentCoords, getForegroundPermission, nearestWithin } from '@/lib/location';
import { ensureDefaultLocations, type Location } from '@/lib/locations';
import { listAssignableOwners, listOwners, type Owner } from '@/lib/owners';
import { parseScheduleInput } from '@/lib/parse-schedule';
import { listProjectsForLocation, moveProject, type Project } from '@/lib/projects';
import { formatDueAt, formatRecurrence, nextOccurrence } from '@/lib/recurrence';
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listReminders,
  setReminderAssignee,
  setReminderOwner,
  setReminderProject,
  uncompleteReminder,
  updateReminderSchedule,
  updateReminderTitle,
  type Reminder,
} from '@/lib/reminders';
import { createRoom, listRooms, type Room } from '@/lib/rooms';

const NO_PROJECT_SECTION_ID = '__none__';

export default function RemindersScreen() {
  const router = useRouter();
  const didAutoLocateRef = useRef(false);
  const locationsRef = useRef<Location[]>([]);
  const lastLocateAtRef = useRef(0);
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme].tint;
  const { width: windowWidth } = useWindowDimensions();
  const isNarrowDisplay = windowWidth < 600;
  const columnWidths = {
    task: isNarrowDisplay ? 90 : 110,
    due: isNarrowDisplay ? 100 : 130,
    assignee: isNarrowDisplay ? 100 : 130,
    delegate: 32,
  };
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [owners, setOwners] = useState<Owner[]>([]);
  const [assignableOwners, setAssignableOwners] = useState<Owner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Record<string, boolean>>({});
  const [projectPopupFor, setProjectPopupFor] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSchedule, setNewSchedule] = useState('');
  const [newScheduleError, setNewScheduleError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scheduleTexts, setScheduleTexts] = useState<Record<string, string>>({});
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string | null>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [assigneePopupFor, setAssigneePopupFor] = useState<string | null>(null);

  useEffect(() => {
    ensureDefaultLocations().then(({ data, error }) => {
      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }
      setLocations(data ?? []);
      locationsRef.current = data ?? [];
      setActiveLocationId((current) => current ?? data?.[0]?.id ?? null);

      if (!didAutoLocateRef.current && (data?.length ?? 0) > 0) {
        didAutoLocateRef.current = true;
        void syncActiveToPosition({ force: true });
      }
    });
    listOwners().then(({ data, error }) => {
      if (!error) {
        setOwners(data ?? []);
      }
    });
    listAssignableOwners().then(({ data, error }) => {
      if (!error) {
        setAssignableOwners(data ?? []);
      }
    });
  }, []);

  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

  // Point the active list at whichever saved location we're currently inside.
  // Never prompts (only runs when location permission is already granted) and is
  // throttled so repeated foregrounding doesn't hammer the GPS.
  const syncActiveToPosition = useCallback(async (opts?: { force?: boolean }) => {
    const locs = locationsRef.current;
    if (locs.length === 0) return;
    if (!opts?.force && Date.now() - lastLocateAtRef.current < 30_000) return;
    try {
      if ((await getForegroundPermission()) !== 'granted') return;
      lastLocateAtRef.current = Date.now();
      const coords = await getCurrentCoords();
      const match = nearestWithin(locs, coords);
      if (match) setActiveLocationId(match.item.id);
    } catch {
      // best-effort
    }
  }, []);

  // Re-check when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncActiveToPosition();
    });
    return () => sub.remove();
  }, [syncActiveToPosition]);

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
    listProjectsForLocation(activeLocationId).then(({ data, error }) => {
      if (!error) {
        setProjects(data ?? []);
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
    const { data, error } = await createReminder(title, [activeLocationId], activeRoomId);
    if (error) {
      setErrorMessage(error.message);
      setIsAdding(false);
      return;
    }
    if (!data) {
      setIsAdding(false);
      return;
    }
    setNewTitle('');
    let created = data;

    const scheduleText = newSchedule.trim();
    if (scheduleText) {
      const parsed = parseScheduleInput(scheduleText);
      if (!parsed) {
        setNewScheduleError('Couldn\'t understand that — try "8/25/26", "next Tue", or "every Tue at 11a".');
      } else {
        setNewScheduleError(null);
        const { data: scheduled, error: scheduleError } = await updateReminderSchedule(created.id, {
          due_at: parsed.dueAt.toISOString(),
          recurrence_freq: parsed.recurrenceFreq,
          recurrence_weekday: parsed.recurrenceWeekday,
        });
        if (scheduleError) {
          setErrorMessage(scheduleError.message);
        } else if (scheduled) {
          created = scheduled;
        }
      }
      setNewSchedule('');
    }

    setReminders((current) => [created, ...current]);
    setIsAdding(false);
  }

  async function handleTitleCommit(reminder: Reminder) {
    const title = (titleDrafts[reminder.id] ?? reminder.title).trim();
    setTitleDrafts((current) => {
      const next = { ...current };
      delete next[reminder.id];
      return next;
    });
    if (!title || title === reminder.title) {
      return;
    }
    setReminders((current) => current.map((item) => (item.id === reminder.id ? { ...item, title } : item)));
    const { error } = await updateReminderTitle(reminder.id, title);
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId, activeRoomId);
    }
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

  async function handleSetOwner(reminder: Reminder, ownerId: string) {
    setReminders((current) =>
      current.map((item) => (item.id === reminder.id ? { ...item, owner_id: ownerId } : item))
    );
    const { error } = await setReminderOwner(reminder.id, ownerId);
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId, activeRoomId);
    }
  }

  async function handleAssign(reminder: Reminder, ownerId: string) {
    setReminders((current) =>
      current.map((item) => (item.id === reminder.id ? { ...item, assignee_id: ownerId } : item))
    );
    const { error } = await setReminderAssignee(reminder.id, ownerId);
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId, activeRoomId);
    }
  }

  async function handleAssigneeSelect(ownerId: string) {
    const reminder = reminders.find((item) => item.id === assigneePopupFor);
    setAssigneePopupFor(null);
    if (reminder) {
      await handleAssign(reminder, ownerId);
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

  async function handleSetReminderProject(reminderId: string, projectId: string | null) {
    setReminders((current) =>
      current.map((item) => (item.id === reminderId ? { ...item, project_id: projectId } : item))
    );
    const { error } = await setReminderProject(reminderId, projectId);
    if (error) {
      setErrorMessage(error.message);
      if (activeLocationId) load(activeLocationId, activeRoomId);
    }
  }

  async function handleProjectPopupSelect(projectId: string | null) {
    const reminderId = projectPopupFor;
    setProjectPopupFor(null);
    if (reminderId) {
      await handleSetReminderProject(reminderId, projectId);
    }
  }

  async function handleMoveProject(id: string, direction: 'up' | 'down') {
    const result = await moveProject(projects, id, direction);
    if (!result || !activeLocationId) {
      return;
    }
    const { data, error } = await listProjectsForLocation(activeLocationId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setProjects(data ?? []);
    }
  }

  const sections = useMemo(() => {
    const byProject = new Map<string, Reminder[]>();
    const noProject: Reminder[] = [];
    for (const reminder of reminders) {
      if (reminder.project_id) {
        const list = byProject.get(reminder.project_id) ?? [];
        list.push(reminder);
        byProject.set(reminder.project_id, list);
      } else {
        noProject.push(reminder);
      }
    }
    const projectSections = projects.map((project) => {
      const items = byProject.get(project.id) ?? [];
      return {
        id: project.id,
        title: project.name,
        count: items.length,
        data: collapsedProjectIds[project.id] ? [] : items,
      };
    });
    return [
      {
        id: NO_PROJECT_SECTION_ID,
        title: '',
        count: noProject.length,
        data: noProject,
      },
      ...projectSections,
    ];
  }, [projects, reminders, collapsedProjectIds]);

  function toggleProjectCollapsed(id: string) {
    setCollapsedProjectIds((current) => ({ ...current, [id]: !current[id] }));
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
                    isActive ? { color: Colors[colorScheme].background } : { color: tintColor },
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
              <Text style={activeRoomId === null ? { color: Colors[colorScheme].background } : { color: tintColor }}>All</Text>
            </Pressable>
          )}
          {rooms.map((room) => {
            const isActive = room.id === activeRoomId;
            return (
              <Pressable
                key={room.id}
                style={[styles.roomButton, { borderColor: tintColor }, isActive && { backgroundColor: tintColor }]}
                onPress={() => setActiveRoomId(room.id)}>
                <Text style={isActive ? { color: Colors[colorScheme].background } : { color: tintColor }}>{room.name}</Text>
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
            <View style={[styles.colTask, { minWidth: columnWidths.task }]} />
            <View style={[styles.colDue, { minWidth: columnWidths.due }]} />
            <View style={[styles.colAssignee, { width: columnWidths.assignee }]} />
            <View style={[styles.colDelegate, { width: columnWidths.delegate }]} />
            <View style={styles.colTrash} />
          </View>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
            ListHeaderComponent={
              <>
                <View style={styles.row}>
                  <View style={[styles.cell, styles.colDone]} />
                  <View style={styles.taskColumn}>
                    <View style={[styles.cell, styles.colTask, { minWidth: columnWidths.task }]}>
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
                    <View style={styles.metaRow}>
                      <View style={[styles.cell, styles.colDue, { minWidth: columnWidths.due }]}>
                        <TextInput
                          style={[styles.dateInput, { color: Colors[colorScheme].text, borderColor: tintColor }]}
                          value={newSchedule}
                          onChangeText={setNewSchedule}
                          placeholder="When"
                          placeholderTextColor="#888"
                          editable={!isAdding}
                          onSubmitEditing={handleAdd}
                          returnKeyType="done"
                        />
                        {newScheduleError ? <Text style={styles.error}>{newScheduleError}</Text> : null}
                      </View>
                      <View style={[styles.cell, styles.colAssignee, { width: columnWidths.assignee }]} />
                      <View style={[styles.cell, styles.colDelegate, { width: columnWidths.delegate }]} />
                      <View style={[styles.cell, styles.colTrash]} />
                    </View>
                  </View>
                </View>
                {reminders.length === 0 ? <Text style={styles.emptyText}>No reminders yet.</Text> : null}
              </>
            }
            renderSectionHeader={({ section }) => {
              if (section.id === NO_PROJECT_SECTION_ID) {
                return null;
              }
              const projectIndex = projects.findIndex((project) => project.id === section.id);
              const project = projectIndex === -1 ? null : projects[projectIndex];
              return (
                <DropZone onDropReminder={(reminderId) => handleSetReminderProject(reminderId, project ? project.id : null)}>
                  <View style={[styles.sectionHeader, { backgroundColor: Colors[colorScheme].background }]}>
                    <Pressable style={styles.sectionHeaderMain} onPress={() => toggleProjectCollapsed(section.id)}>
                      <Text style={styles.sectionHeaderChevron}>{collapsedProjectIds[section.id] ? '▸' : '▾'}</Text>
                      <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                      <Text style={styles.sectionHeaderCount}>{section.count}</Text>
                    </Pressable>
                    {project && (
                      <View style={styles.projectMoveButtons}>
                        <Pressable onPress={() => handleMoveProject(project.id, 'up')} hitSlop={4} disabled={projectIndex === 0}>
                          <Text style={[styles.moveArrow, projectIndex === 0 && styles.moveArrowDisabled]}>▲</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleMoveProject(project.id, 'down')}
                          hitSlop={4}
                          disabled={projectIndex === projects.length - 1}>
                          <Text style={[styles.moveArrow, projectIndex === projects.length - 1 && styles.moveArrowDisabled]}>▼</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </DropZone>
              );
            }}
            renderItem={({ item }) => {
              const recurrenceLabel = formatRecurrence(item.recurrence_freq, item.recurrence_weekday);
              const scheduleError = scheduleErrors[item.id];
              const projectName = projects.find((project) => project.id === item.project_id)?.name;
              return (
                <DraggableRow reminderId={item.id}>
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
                  <View style={styles.taskColumn}>
                    <View style={[styles.cell, styles.colTask, { minWidth: columnWidths.task }]}>
                      <View style={styles.taskTitleRow}>
                        <TextInput
                          style={[
                            styles.rowTitleInput,
                            { color: Colors[colorScheme].text },
                            item.completed_at && styles.rowTitleCompleted,
                          ]}
                          value={titleDrafts[item.id] ?? item.title}
                          onChangeText={(text) => setTitleDrafts((current) => ({ ...current, [item.id]: text }))}
                          onBlur={() => handleTitleCommit(item)}
                          onSubmitEditing={() => handleTitleCommit(item)}
                          returnKeyType="done"
                        />
                        <Pressable onPress={() => router.push(`/reminder/${item.id}`)} hitSlop={6}>
                          <Text style={[styles.detailChevron, { color: tintColor }]}>›</Text>
                        </Pressable>
                      </View>
                      <Pressable onPress={() => setProjectPopupFor(item.id)} hitSlop={4}>
                        <Text style={styles.rowMeta}>{projectName ?? '+ Project'}</Text>
                      </Pressable>
                    </View>
                    <View style={styles.metaRow}>
                      <View style={[styles.cell, styles.colDue, { minWidth: columnWidths.due }]}>
                        <TextInput
                          style={[styles.dateInput, { color: Colors[colorScheme].text, borderColor: tintColor }]}
                          value={scheduleTexts[item.id] ?? formatDueAt(item.due_at) ?? ''}
                          onChangeText={(text) => setScheduleTexts((current) => ({ ...current, [item.id]: text }))}
                          onFocus={() => {
                            if (scheduleTexts[item.id] === undefined) {
                              setScheduleTexts((current) => ({ ...current, [item.id]: '' }));
                            }
                          }}
                          placeholder="When"
                          placeholderTextColor="#888"
                          onSubmitEditing={() => handleQuickSchedule(item)}
                          returnKeyType="done"
                        />
                        {recurrenceLabel ? <Text style={styles.rowMeta}>{recurrenceLabel}</Text> : null}
                        {scheduleError ? <Text style={styles.error}>{scheduleError}</Text> : null}
                      </View>
                      <View style={[styles.cell, styles.colAssignee, { width: columnWidths.assignee }]}>
                        <AssigneeSelect
                          value={item.owner_id}
                          options={owners}
                          onChange={(ownerId) => handleSetOwner(item, ownerId)}
                        />
                      </View>
                      <View style={[styles.cell, styles.colDelegate, { width: columnWidths.delegate }]}>
                        <Pressable
                          style={styles.delegateButton}
                          onPress={() => setAssigneePopupFor(item.id)}
                          hitSlop={8}
                          accessibilityLabel="Delegate">
                          <Text style={styles.delegateButtonText}>🤝</Text>
                        </Pressable>
                      </View>
                      <View style={[styles.cell, styles.colTrash]}>
                        <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                          <Text style={styles.trashIcon}>🗑</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
                </DraggableRow>
              );
            }}
          />
        </>
      )}
      <Modal
        visible={assigneePopupFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAssigneePopupFor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAssigneePopupFor(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign to</Text>
            {assignableOwners.map((owner) => (
              <Pressable
                key={owner.id}
                style={styles.modalOption}
                onPress={() => handleAssigneeSelect(owner.id)}>
                <Text style={styles.modalOptionText}>{owner.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={projectPopupFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setProjectPopupFor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProjectPopupFor(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Move to project</Text>
            <Pressable style={styles.modalOption} onPress={() => handleProjectPopupSelect(null)}>
              <Text style={styles.modalOptionText}>No project</Text>
            </Pressable>
            {projects.map((project) => (
              <Pressable
                key={project.id}
                style={styles.modalOption}
                onPress={() => handleProjectPopupSelect(project.id)}>
                <Text style={styles.modalOptionText}>{project.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  projectMoveButtons: {
    gap: 2,
  },
  moveArrow: {
    fontSize: 12,
    opacity: 0.6,
  },
  moveArrowDisabled: {
    opacity: 0.2,
  },
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sectionHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sectionHeaderChevron: {
    fontSize: 12,
    opacity: 0.6,
    width: 12,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeaderCount: {
    fontSize: 12,
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  taskColumn: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
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
  },
  colDue: {
    flex: 2,
  },
  colAssignee: {},
  colDelegate: {},
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
  rowTitle: {
    fontSize: 16,
    flexShrink: 1,
  },
  rowTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowTitleInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 2,
  },
  detailChevron: {
    fontSize: 20,
    fontWeight: '600',
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
  trashIcon: {
    fontSize: 18,
  },
  delegateButton: {
    alignItems: 'center',
  },
  delegateButtonText: {
    fontSize: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    borderRadius: 12,
    padding: 16,
    minWidth: 220,
    gap: 2,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.6,
    marginBottom: 8,
  },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  modalOptionText: {
    fontSize: 16,
  },
});
