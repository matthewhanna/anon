import { supabase } from '@/lib/supabase';

export type Reminder = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  location_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function listReminders(locationId: string | null) {
  return supabase
    .from('reminders')
    .select('*')
    .eq('location_id', locationId)
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .returns<Reminder[]>();
}

export async function createReminder(title: string, locationId: string | null) {
  return supabase
    .from('reminders')
    .insert({ title, location_id: locationId })
    .select()
    .single<Reminder>();
}

export async function setReminderCompleted(id: string, completed: boolean) {
  return supabase
    .from('reminders')
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id)
    .select()
    .single<Reminder>();
}

export async function deleteReminder(id: string) {
  return supabase.from('reminders').delete().eq('id', id);
}
