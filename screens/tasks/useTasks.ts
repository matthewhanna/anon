import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { useLocationContext } from '@/lib/location-context';
import { listAssignableOwners, listOwners, type Owner } from '@/lib/owners';
import { SCHEDULE_HELP, parseScheduleInput } from '@/lib/parse-schedule';
import { listProjectsForLocation, moveProject as moveProjectApi, type Project } from '@/lib/projects';
import { nextOccurrence } from '@/lib/recurrence';
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listReminders,
  setReminderAssignee,
  setReminderOwner,
  setReminderProject as setReminderProjectApi,
  uncompleteReminder,
  updateReminderSchedule,
  updateReminderTitle,
  type Reminder,
} from '@/lib/reminders';
import type { AddReminderInput } from '@/screens/tasks/AddReminderRow';
import { buildSections } from '@/screens/tasks/buildSections';
import type { ScheduleFields } from '@/screens/tasks/ReminderRow';

// All Tasks-screen data + mutations. Optimistic updates with a reload on error.
export function useTasks() {
  const { session } = useAuth();
  const { activeLocationId, activeRoomId } = useLocationContext();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [assignableOwners, setAssignableOwners] = useState<Owner[]>([]);
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const myOwnerId = owners.find((o) => o.auth_user_id === session?.user?.id)?.id ?? null;

  useEffect(() => {
    listOwners().then(({ data, error }) => {
      if (!error) setOwners(data ?? []);
    });
    listAssignableOwners().then(({ data, error }) => {
      if (!error) setAssignableOwners(data ?? []);
    });
  }, []);

  const load = useCallback(async (locationId: string, roomId: string | null) => {
    const { data, error } = await listReminders(locationId, roomId);
    if (error) setErrorMessage(error.message);
    else {
      setErrorMessage(null);
      setReminders(data ?? []);
    }
  }, []);

  const reloadOnError = useCallback(() => {
    if (activeLocationId) load(activeLocationId, activeRoomId);
  }, [activeLocationId, activeRoomId, load]);

  useEffect(() => {
    if (!activeLocationId) return;
    listProjectsForLocation(activeLocationId).then(({ data, error }) => {
      if (!error) setProjects(data ?? []);
    });
  }, [activeLocationId]);

  useEffect(() => {
    if (!activeLocationId) return;
    setIsLoading(true);
    load(activeLocationId, activeRoomId).finally(() => setIsLoading(false));
  }, [activeLocationId, activeRoomId, load]);

  const refresh = useCallback(async () => {
    if (!activeLocationId) return;
    setIsRefreshing(true);
    await load(activeLocationId, activeRoomId);
    setIsRefreshing(false);
  }, [activeLocationId, activeRoomId, load]);

  const patch = useCallback((id: string, fields: Partial<Reminder>) => {
    setReminders((current) => current.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  }, []);

  const add = useCallback(
    async ({ title, scheduleText, assigneeId }: AddReminderInput) => {
      if (!activeLocationId) return { scheduleError: null };
      setIsAdding(true);
      const { data, error } = await createReminder(title, [activeLocationId], activeRoomId);
      if (error || !data) {
        if (error) setErrorMessage(error.message);
        setIsAdding(false);
        return { scheduleError: null };
      }

      let created = data;
      if (assigneeId && assigneeId !== created.assignee_id) {
        const { data: reassigned, error: assignError } = await setReminderAssignee(
          created.id,
          assigneeId
        );
        if (assignError) setErrorMessage(assignError.message);
        else if (reassigned) created = reassigned;
      }

      let scheduleError: string | null = null;
      if (scheduleText) {
        const parsed = parseScheduleInput(scheduleText);
        if (!parsed) {
          scheduleError = SCHEDULE_HELP;
        } else {
          const { data: scheduled, error: schedErr } = await updateReminderSchedule(created.id, {
            due_at: parsed.dueAt.toISOString(),
            recurrence_freq: parsed.recurrenceFreq,
            recurrence_weekday: parsed.recurrenceWeekday,
          });
          if (schedErr) setErrorMessage(schedErr.message);
          else if (scheduled) created = scheduled;
        }
      }

      setReminders((current) => [created, ...current]);
      setIsAdding(false);
      return { scheduleError };
    },
    [activeLocationId, activeRoomId]
  );

  const commitTitle = useCallback(
    async (reminder: Reminder, title: string) => {
      patch(reminder.id, { title });
      const { error } = await updateReminderTitle(reminder.id, title);
      if (error) {
        setErrorMessage(error.message);
        reloadOnError();
      }
    },
    [patch, reloadOnError]
  );

  const toggle = useCallback(
    async (reminder: Reminder) => {
      const isRecurring = Boolean(reminder.recurrence_freq && reminder.due_at);
      const nextCompleted = !reminder.completed_at;

      if (isRecurring) {
        const next = nextOccurrence(
          new Date(reminder.due_at as string),
          reminder.recurrence_freq!,
          reminder.recurrence_weekday
        );
        patch(reminder.id, { due_at: next.toISOString() });
      } else {
        patch(reminder.id, { completed_at: nextCompleted ? new Date().toISOString() : null });
      }

      const { error } =
        isRecurring || nextCompleted
          ? await completeReminder(reminder)
          : await uncompleteReminder(reminder.id);
      if (error) {
        setErrorMessage(error.message);
        reloadOnError();
      }
    },
    [patch, reloadOnError]
  );

  const schedule = useCallback(
    async (reminder: Reminder, fields: ScheduleFields) => {
      patch(reminder.id, fields);
      const { error } = await updateReminderSchedule(reminder.id, fields);
      if (error) {
        setErrorMessage(error.message);
        reloadOnError();
      }
    },
    [patch, reloadOnError]
  );

  const setOwner = useCallback(
    async (reminder: Reminder, ownerId: string) => {
      patch(reminder.id, { owner_id: ownerId });
      const { error } = await setReminderOwner(reminder.id, ownerId);
      if (error) {
        setErrorMessage(error.message);
        reloadOnError();
      }
    },
    [patch, reloadOnError]
  );

  const assign = useCallback(
    async (reminder: Reminder, ownerId: string) => {
      patch(reminder.id, { assignee_id: ownerId });
      const { error } = await setReminderAssignee(reminder.id, ownerId);
      if (error) {
        setErrorMessage(error.message);
        reloadOnError();
      }
    },
    [patch, reloadOnError]
  );

  const remove = useCallback(
    async (reminder: Reminder) => {
      setReminders((current) => current.filter((r) => r.id !== reminder.id));
      const { error } = await deleteReminder(reminder.id);
      if (error) {
        setErrorMessage(error.message);
        reloadOnError();
      }
    },
    [reloadOnError]
  );

  const setReminderProject = useCallback(
    async (reminderId: string, projectId: string | null) => {
      patch(reminderId, { project_id: projectId });
      const { error } = await setReminderProjectApi(reminderId, projectId);
      if (error) {
        setErrorMessage(error.message);
        reloadOnError();
      }
    },
    [patch, reloadOnError]
  );

  const moveProject = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      const result = await moveProjectApi(projects, id, direction);
      if (!result || !activeLocationId) return;
      const { data, error } = await listProjectsForLocation(activeLocationId);
      if (error) setErrorMessage(error.message);
      else setProjects(data ?? []);
    },
    [projects, activeLocationId]
  );

  const toggleProjectCollapsed = useCallback((id: string) => {
    setCollapsedProjectIds((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const sections = useMemo(
    () => buildSections(reminders, projects, collapsedProjectIds),
    [reminders, projects, collapsedProjectIds]
  );

  return {
    reminders,
    projects,
    owners,
    assignableOwners,
    myOwnerId,
    sections,
    collapsedProjectIds,
    isLoading,
    isRefreshing,
    isAdding,
    errorMessage,
    refresh,
    add,
    commitTitle,
    toggle,
    schedule,
    setOwner,
    assign,
    remove,
    setReminderProject,
    moveProject,
    toggleProjectCollapsed,
  };
}
