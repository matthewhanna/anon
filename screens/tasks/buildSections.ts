import type { Project } from '@/lib/projects';
import type { Reminder } from '@/lib/reminders';

export const NO_PROJECT_SECTION_ID = '__none__';

export type ReminderSection = {
  id: string;
  title: string;
  count: number;
  data: Reminder[];
};

// Groups reminders into a leading "no project" section followed by one section
// per project (in project order). A collapsed project contributes an empty
// `data` array but keeps its real `count`.
export function buildSections(
  reminders: Reminder[],
  projects: Project[],
  collapsed: Record<string, boolean>
): ReminderSection[] {
  const byProject = new Map<string, Reminder[]>();
  const noProject: Reminder[] = [];
  for (const reminder of reminders) {
    if (reminder.project_id) {
      const list = byProject.get(reminder.project_id) ?? [];
      list.push(reminder);
      byProject.set(reminder.project_id, list);
    } else {
      noProject.push(reminder);
    }
  }

  const projectSections = projects.map((project) => {
    const items = byProject.get(project.id) ?? [];
    return {
      id: project.id,
      title: project.name,
      count: items.length,
      data: collapsed[project.id] ? [] : items,
    };
  });

  return [
    { id: NO_PROJECT_SECTION_ID, title: '', count: noProject.length, data: noProject },
    ...projectSections,
  ];
}
