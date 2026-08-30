import { Pressable, StyleSheet } from 'react-native';

import DropZone from '@/components/DropZone';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Project } from '@/lib/projects';
import type { ReminderSection } from '@/screens/tasks/buildSections';

export default function ProjectSectionHeader({
  section,
  project,
  projectIndex,
  projectCount,
  collapsed,
  onToggle,
  onMove,
  onDropReminder,
}: {
  section: ReminderSection;
  project: Project | null;
  projectIndex: number;
  projectCount: number;
  collapsed: boolean;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onDropReminder: (reminderId: string, projectId: string | null) => void;
}) {
  const scheme = useColorScheme();

  return (
    <DropZone onDropReminder={(id) => onDropReminder(id, project ? project.id : null)}>
      <View style={[styles.header, { backgroundColor: Colors[scheme].background }]}>
        <Pressable style={styles.main} onPress={() => onToggle(section.id)}>
          <Text style={styles.chevron}>{collapsed ? '▸' : '▾'}</Text>
          <Text style={styles.title}>{section.title}</Text>
          <Text style={styles.count}>{section.count}</Text>
        </Pressable>
        {project ? (
          <View style={styles.moveButtons}>
            <Pressable
              onPress={() => onMove(project.id, 'up')}
              hitSlop={4}
              disabled={projectIndex === 0}>
              <Text style={[styles.arrow, projectIndex === 0 && styles.arrowDisabled]}>▲</Text>
            </Pressable>
            <Pressable
              onPress={() => onMove(project.id, 'down')}
              hitSlop={4}
              disabled={projectIndex === projectCount - 1}>
              <Text style={[styles.arrow, projectIndex === projectCount - 1 && styles.arrowDisabled]}>
                ▼
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </DropZone>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  chevron: { fontSize: 12, opacity: 0.6, width: 12 },
  title: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 12, opacity: 0.5 },
  moveButtons: { gap: 2 },
  arrow: { fontSize: 12, opacity: 0.6 },
  arrowDisabled: { opacity: 0.2 },
});
