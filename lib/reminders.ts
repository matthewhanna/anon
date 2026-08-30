import type { PostgrestError } from '@supabase/supabase-js';

import { nextOccurrence, type RecurrenceFreq } from '@/lib/recurrence';
import { supabase } from '@/lib/supabase';

export type Reminder = {
  id: string;
  owner_id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  room_id: string | null;
  project_id: string | null;
  assignee_id: string;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_weekday: number | null;
  created_at: string;
  updated_at: string;
};

// A reminder belongs to zero or more locations (reminder_locations). Lists the
// reminders tied to one location; roomId null means no room filter. Grouping
// into project sections happens client-side.
export async function listReminders(
  locationId: string,
  roomId: string | null
): Promise<{ data: Reminder[] | null; error: PostgrestError | null }> {
  const { data: links, error: linkError } = await supabase
    .from('reminder_locations')
    .select('reminder_id')
    .eq('location_id', locationId);
  if (linkError) return { data: null, error: linkError };
  const ids = (links ?? []).map((l) => l.reminder_id as string);
  if (ids.length === 0) return { data: [], error: null };

  let query = supabase.from('reminders').select('*').in('id', ids);
  if (roomId) query = query.eq('room_id', roomId);
  const { data, error } = await query
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .returns<Reminder[]>();
  return { data, error };
}

export async function getReminder(id: string) {
  return supabase.from('reminders').select('*').eq('id', id).single<Reminder>();
}

export async function getReminderLocationIds(reminderId: string) {
  const { data, error } = await supabase
    .from('reminder_locations')
    .select('location_id')
    .eq('reminder_id', reminderId);
  return { data: data ? data.map((r) => r.location_id as string) : null, error };
}

// Replaces the reminder's location set (delete-then-insert; not atomic).
export async function setReminderLocations(reminderId: string, locationIds: string[]) {
  const { error: delError } = await supabase
    .from('reminder_locations')
    .delete()
    .eq('reminder_id', reminderId);
  if (delError) return { error: delError };
  if (locationIds.length === 0) return { error: null };
  const { error } = await supabase
    .from('reminder_locations')
    .insert(locationIds.map((location_id) => ({ reminder_id: reminderId, location_id })));
  return { error };
}

export async function createReminder(
  title: string,
  locationIds: string[],
  roomId: string | null
): Promise<{ data: Reminder | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('reminders')
    .insert({ title, room_id: roomId })
    .select()
    .single<Reminder>();
  if (error || !data) return { data, error };
  if (locationIds.length > 0) {
    const { error: linkError } = await supabase
      .from('reminder_locations')
      .insert(locationIds.map((location_id) => ({ reminder_id: data.id, location_id })));
    if (linkError) return { data, error: linkError };
  }
  return { data, error: null };
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

// Reassignment goes through RPCs (SECURITY DEFINER), not a plain update:
// Postgres requires an UPDATE's new row to also pass the table's SELECT
// policy, so a direct update could never set owner_id/assignee_id to
// something outside the caller's own visibility — even with an
// unconditional WITH CHECK. These functions check visibility of the
// *current* reminder, then bypass RLS for the write itself.
export async function setReminderAssignee(id: string, ownerId: string) {
  const { data, error } = await supabase.rpc('reassign_reminder_assignee', {
    target_reminder_id: id,
    new_assignee_id: ownerId,
  });
  return { data: data as Reminder | null, error };
}

export async function setReminderOwner(id: string, ownerId: string) {
  const { data, error } = await supabase.rpc('reassign_reminder_owner', {
    target_reminder_id: id,
    new_owner_id: ownerId,
  });
  return { data: data as Reminder | null, error };
}

export async function setReminderProject(id: string, projectId: string | null) {
  return supabase.from('reminders').update({ project_id: projectId }).eq('id', id).select().single<Reminder>();
}

export async function updateReminderTitle(id: string, title: string) {
  return supabase.from('reminders').update({ title }).eq('id', id).select().single<Reminder>();
}

export async function deleteReminder(id: string) {
  return supabase.from('reminders').delete().eq('id', id);
}
