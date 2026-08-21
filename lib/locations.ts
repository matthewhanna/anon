import { supabase } from '@/lib/supabase';

export type Location = {
  id: string;
  owner_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_m: number | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_LOCATION_NAMES = ['Home', 'Work'];

export async function listLocations() {
  return supabase.from('locations').select('*').order('created_at', { ascending: true }).returns<Location[]>();
}

export async function ensureDefaultLocations() {
  const { data, error } = await listLocations();
  if (error || !data) {
    return { data, error };
  }

  const existingNames = new Set(data.map((location) => location.name));
  const missingNames = DEFAULT_LOCATION_NAMES.filter((name) => !existingNames.has(name));
  if (missingNames.length === 0) {
    return { data, error: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('locations')
    .insert(missingNames.map((name) => ({ name })))
    .select()
    .returns<Location[]>();
  if (insertError) {
    return { data, error: insertError };
  }

  return { data: [...data, ...(inserted ?? [])], error: null };
}
