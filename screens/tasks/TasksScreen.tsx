import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet } from 'react-native';

import OptionsModal from '@/components/OptionsModal';
import { Text, View } from '@/components/Themed';
import { useLocationHeader } from '@/components/useLocationHeader';
import type { Reminder } from '@/lib/reminders';
import AddReminderRow from '@/screens/tasks/AddReminderRow';
import { NO_PROJECT_SECTION_ID, type ReminderSection } from '@/screens/tasks/buildSections';
import { useColumnWidths } from '@/screens/tasks/columns';
import ProjectSectionHeader from '@/screens/tasks/ProjectSectionHeader';
import ReminderRow from '@/screens/tasks/ReminderRow';
import { useTasks } from '@/screens/tasks/useTasks';

const NO_PROJECT_OPTION = '__none__';

export default function TasksScreen() {
  useLocationHeader();
  const router = useRouter();
  const columns = useColumnWidths();
  const t = useTasks();

  const [delegateFor, setDelegateFor] = useState<string | null>(null);
  const [projectFor, setProjectFor] = useState<string | null>(null);

  const openDelegate = useCallback((r: Reminder) => setDelegateFor(r.id), []);
  const openProject = useCallback((r: Reminder) => setProjectFor(r.id), []);
  const openDetail = useCallback((r: Reminder) => router.push(`/reminder/${r.id}`), [router]);

  return (
    <View style={styles.container}>
      {t.errorMessage ? <Text style={styles.error}>{t.errorMessage}</Text> : null}

      {t.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <SectionList<Reminder, ReminderSection>
          sections={t.sections}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={t.isRefreshing} onRefresh={t.refresh} />}
          ListHeaderComponent={
            <>
              <AddReminderRow
                assignableOwners={t.assignableOwners}
                myOwnerId={t.myOwnerId}
                columns={columns}
                disabled={t.isAdding}
                onAdd={t.add}
              />
              {t.reminders.length === 0 ? (
                <Text style={styles.emptyText}>No reminders yet.</Text>
              ) : null}
            </>
          }
          renderSectionHeader={({ section }) => {
            if (section.id === NO_PROJECT_SECTION_ID) return null;
            const projectIndex = t.projects.findIndex((p) => p.id === section.id);
            const project = projectIndex === -1 ? null : t.projects[projectIndex];
            return (
              <ProjectSectionHeader
                section={section}
                project={project}
                projectIndex={projectIndex}
                projectCount={t.projects.length}
                collapsed={Boolean(t.collapsedProjectIds[section.id])}
                onToggle={t.toggleProjectCollapsed}
                onMove={t.moveProject}
                onDropReminder={t.setReminderProject}
              />
            );
          }}
          renderItem={({ item }) => (
            <ReminderRow
              reminder={item}
              owners={t.owners}
              projectName={t.projects.find((p) => p.id === item.project_id)?.name}
              columns={columns}
              onToggle={t.toggle}
              onCommitTitle={t.commitTitle}
              onSchedule={t.schedule}
              onSetOwner={t.setOwner}
              onOpenDelegate={openDelegate}
              onOpenProject={openProject}
              onDelete={t.remove}
              onOpenDetail={openDetail}
            />
          )}
        />
      )}

      <OptionsModal
        visible={delegateFor !== null}
        title="Assign to"
        options={t.assignableOwners.map((o) => ({ id: o.id, label: o.name }))}
        onSelect={(ownerId) => {
          const reminder = t.reminders.find((r) => r.id === delegateFor);
          setDelegateFor(null);
          if (reminder) t.assign(reminder, ownerId);
        }}
        onClose={() => setDelegateFor(null)}
      />

      <OptionsModal
        visible={projectFor !== null}
        title="Move to project"
        options={[
          { id: NO_PROJECT_OPTION, label: 'No project' },
          ...t.projects.map((p) => ({ id: p.id, label: p.name })),
        ]}
        onSelect={(id) => {
          const reminderId = projectFor;
          setProjectFor(null);
          if (reminderId) {
            t.setReminderProject(reminderId, id === NO_PROJECT_OPTION ? null : id);
          }
        }}
        onClose={() => setProjectFor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#e53e3e', marginBottom: 8 },
  emptyText: { opacity: 0.6 },
});
