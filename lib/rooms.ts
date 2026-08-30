import { supabase } from '@/lib/supabase';

export type Room = {
  id: string;
  owner_id: string;
  location_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export async function listRooms(locationId: string) {
  return supabase
    .from('rooms')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: true })
    .returns<Room[]>();
}

export async function createRoom(locationId: string, name: string) {
  return supabase.from('rooms').insert({ location_id: locationId, name: name.trim() }).select().single<Room>();
}

export async function renameRoom(id: string, name: string) {
  return supabase.from('rooms').update({ name: name.trim() }).eq('id', id).select().single<Room>();
}

export async function deleteRoom(id: string) {
  return supabase.from('rooms').delete().eq('id', id);
}
