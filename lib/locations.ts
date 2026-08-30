import type { Coords } from '@/lib/location';
import { clampRadiusM } from '@/lib/location';
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

export async function getLocation(id: string) {
  return supabase.from('locations').select('*').eq('id', id).single<Location>();
}

export async function createLocation(name: string) {
  return supabase.from('locations').insert({ name: name.trim() }).select().single<Location>();
}

export async function renameLocation(id: string, name: string) {
  return supabase.from('locations').update({ name: name.trim() }).eq('id', id).select().single<Location>();
}

export async function deleteLocation(id: string) {
  return supabase.from('locations').delete().eq('id', id);
}

// Sets the geofence circle for a location. radius is clamped to the supported
// range; reminders/list-switching treat coords + radius_m as one unit.
export async function setLocationGeo(id: string, coords: Coords, radiusM: number) {
  return supabase
    .from('locations')
    .update({
      latitude: coords.latitude,
      longitude: coords.longitude,
      radius_m: clampRadiusM(radiusM),
    })
    .eq('id', id)
    .select()
    .single<Location>();
}

export async function clearLocationGeo(id: string) {
  return supabase
    .from('locations')
    .update({ latitude: null, longitude: null, radius_m: null })
    .eq('id', id)
    .select()
    .single<Location>();
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
