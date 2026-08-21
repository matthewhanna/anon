import { supabase } from '@/lib/supabase';

export type Owner = {
  id: string;
  creator_id: string;
  auth_user_id: string | null;
  name: string;
  is_individual: boolean;
  created_at: string;
  updated_at: string;
};

export async function listOwners() {
  return supabase.from('owners').select('*').order('is_individual', { ascending: false }).order('name').returns<Owner[]>();
}

// Delegation is individual-only — matches the reminders_check_assignee trigger.
export async function listAssignableOwners() {
  return supabase.from('owners').select('*').eq('is_individual', true).order('name').returns<Owner[]>();
}
