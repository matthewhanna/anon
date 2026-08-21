import { nextOccurrence, type RecurrenceFreq } from '@/lib/recurrence';
import { supabase } from '@/lib/supabase';

export type Reminder = {
  id: string;
  owner_id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  location_id: string | null;
  room_id: string | null;
  assignee_id: string | null;
  assignee_group_id: string | null;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_weekday: number | null;
  created_at: string;
  updated_at: string;
};

// roomId: null means no room filter (every reminder in the location, tagged or not).
export async function listReminders(locationId: string | null, roomId: string | null) {
  let query = supabase.from('reminders').select('*').eq('location_id', locationId);
  if (roomId) {
    query = query.eq('room_id', roomId);
  }
  return query
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .returns<Reminder[]>();
}

export async function getReminder(id: string) {
  return supabase.from('reminders').select('*').eq('id', id).single<Reminder>();
}

export async function createReminder(title: string, locationId: string | null, roomId: string | null) {
  return supabase
    .from('reminders')
    .insert({ title, location_id: locationId, room_id: roomId })
    .select()
    .single<Reminder>();
}

// Completing a recurring reminder never sets completed_at — it just rolls
// due_at forward to the next occurrence, so it stays active in the list.
export async function completeReminder(reminder: Reminder) {
  if (reminder.recurrence_freq && reminder.due_at) {
    const next = nextOccurrence(new Date(reminder.due_at), reminder.recurrence_freq, reminder.recurrence_weekday);
    return supabase
      .from('reminders')
      .update({ due_at: next.toISOString() })
      .eq('id', reminder.id)
      .select()
      .single<Reminder>();
  }
  return supabase
    .from('reminders')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', reminder.id)
    .select()
    .single<Reminder>();
}

export async function uncompleteReminder(id: string) {
  return supabase.from('reminders').update({ completed_at: null }).eq('id', id).select().single<Reminder>();
}

// Skips this occurrence of a recurring reminder without counting it as done.
export async function skipReminderOccurrence(reminder: Reminder) {
  if (!reminder.recurrence_freq || !reminder.due_at) {
    throw new Error('skipReminderOccurrence requires a recurring reminder with a due date');
  }
  const next = nextOccurrence(new Date(reminder.due_at), reminder.recurrence_freq, reminder.recurrence_weekday);
  return supabase
    .from('reminders')
    .update({ due_at: next.toISOString() })
    .eq('id', reminder.id)
    .select()
    .single<Reminder>();
}

export async function snoozeReminder(reminder: Reminder) {
  const base = reminder.due_at ? new Date(reminder.due_at) : new Date();
  base.setDate(base.getDate() + 1);
  return supabase
    .from('reminders')
    .update({ due_at: base.toISOString() })
    .eq('id', reminder.id)
    .select()
    .single<Reminder>();
}

// Setting due_at to null also clears recurrence, since a recurring reminder
// needs a due date to advance from.
export async function setReminderDueAt(id: string, dueAt: Date | null) {
  const fields = dueAt
    ? { due_at: dueAt.toISOString() }
    : { due_at: null, recurrence_freq: null, recurrence_weekday: null };
  return supabase.from('reminders').update(fields).eq('id', id).select().single<Reminder>();
}

export async function updateReminderSchedule(
  id: string,
  fields: {
    due_at: string | null;
    recurrence_freq: RecurrenceFreq | null;
    recurrence_weekday: number | null;
  }
) {
  return supabase.from('reminders').update(fields).eq('id', id).select().single<Reminder>();
}

export type AssigneeTarget = { type: 'member'; id: string } | { type: 'group'; id: string };

// A reminder is always assigned to a person or a group, never both, never neither.
export async function setReminderAssignee(id: string, target: AssigneeTarget) {
  const fields =
    target.type === 'member'
      ? { assignee_id: target.id, assignee_group_id: null }
      : { assignee_id: null, assignee_group_id: target.id };
  return supabase.from('reminders').update(fields).eq('id', id).select().single<Reminder>();
}

export async function deleteReminder(id: string) {
  return supabase.from('reminders').delete().eq('id', id);
}
