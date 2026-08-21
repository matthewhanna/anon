import { supabase } from '@/lib/supabase';

export type FamilyMember = {
  id: string;
  owner_id: string;
  auth_user_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

export async function listFamilyMembers() {
  return supabase
    .from('family_members')
    .select('*')
    .order('created_at', { ascending: true })
    .returns<FamilyMember[]>();
}
