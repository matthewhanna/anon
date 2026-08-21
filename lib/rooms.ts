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
  return supabase.from('rooms').insert({ location_id: locationId, name }).select().single<Room>();
}
