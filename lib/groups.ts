import { supabase } from '@/lib/supabase';

export type Group = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export async function listGroups() {
  return supabase.from('groups').select('*').order('created_at', { ascending: true }).returns<Group[]>();
}
