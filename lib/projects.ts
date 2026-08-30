import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  priority: number;
  created_at: string;
  updated_at: string;
};

export async function listProjects() {
  return supabase.from('projects').select('*').order('priority', { ascending: true }).returns<Project[]>();
}

// Projects assigned to a given location (project_locations), priority-ordered.
export async function listProjectsForLocation(
  locationId: string
): Promise<{ data: Project[] | null; error: PostgrestError | null }> {
  const { data: links, error: linkError } = await supabase
    .from('project_locations')
    .select('project_id')
    .eq('location_id', locationId);
  if (linkError) return { data: null, error: linkError };
  const ids = (links ?? []).map((l) => l.project_id as string);
  if (ids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .in('id', ids)
    .order('priority', { ascending: true })
    .returns<Project[]>();
  return { data, error };
}

// project id -> assigned location names, for list display.
export async function listProjectLocationNames(): Promise<Record<string, string[]>> {
  const { data } = await supabase.from('project_locations').select('project_id, locations(name)');
  const rows = (data ?? []) as unknown as {
    project_id: string;
    locations: { name: string } | { name: string }[] | null;
  }[];
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    const loc = Array.isArray(row.locations) ? row.locations[0] : row.locations;
    if (!loc) continue;
    (map[row.project_id] ??= []).push(loc.name);
  }
  return map;
}

export async function getProjectLocationIds(projectId: string) {
  const { data, error } = await supabase
    .from('project_locations')
    .select('location_id')
    .eq('project_id', projectId);
  return { data: data ? data.map((r) => r.location_id as string) : null, error };
}

// Replaces the project's location set (delete-then-insert; not atomic).
export async function setProjectLocations(projectId: string, locationIds: string[]) {
  const { error: delError } = await supabase
    .from('project_locations')
    .delete()
    .eq('project_id', projectId);
  if (delError) return { error: delError };
  if (locationIds.length === 0) return { error: null };
  const { error } = await supabase
    .from('project_locations')
    .insert(locationIds.map((location_id) => ({ project_id: projectId, location_id })));
  return { error };
}

export async function createProject(name: string) {
  return supabase.from('projects').insert({ name: name.trim() }).select().single<Project>();
}

export async function renameProject(id: string, name: string) {
  return supabase.from('projects').update({ name: name.trim() }).eq('id', id).select().single<Project>();
}

export async function deleteProject(id: string) {
  return supabase.from('projects').delete().eq('id', id);
}

export async function setProjectPriority(id: string, priority: number) {
  return supabase.from('projects').update({ priority }).eq('id', id).select().single<Project>();
}

// Swaps this project's priority with the one immediately before/after it
// in the given (already priority-sorted) list.
export async function moveProject(projects: Project[], id: string, direction: 'up' | 'down') {
  const index = projects.findIndex((project) => project.id === id);
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= projects.length) {
    return null;
  }
  const current = projects[index];
  const neighbor = projects[swapIndex];
  const [a, b] = await Promise.all([
    setProjectPriority(current.id, neighbor.priority),
    setProjectPriority(neighbor.id, current.priority),
  ]);
  return { a, b };
}
