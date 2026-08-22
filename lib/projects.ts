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

export async function createProject(name: string) {
  return supabase.from('projects').insert({ name }).select().single<Project>();
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
