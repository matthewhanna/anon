import { memo, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import AssigneeSelect from '@/components/AssigneeSelect';
import DraggableRow from '@/components/DraggableRow';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Owner } from '@/lib/owners';
import { SCHEDULE_HELP, parseScheduleInput } from '@/lib/parse-schedule';
import { formatDueAt, formatRecurrence, type RecurrenceFreq } from '@/lib/recurrence';
import type { Reminder } from '@/lib/reminders';
import { rowStyles, type ColumnWidths } from '@/screens/tasks/columns';

export type ScheduleFields = {
  due_at: string;
  recurrence_freq: RecurrenceFreq | null;
  recurrence_weekday: number | null;
};

type Props = {
  reminder: Reminder;
  owners: Owner[];
  projectName: string | undefined;
  columns: ColumnWidths;
  onToggle: (reminder: Reminder) => void;
  onCommitTitle: (reminder: Reminder, title: string) => void;
  onSchedule: (reminder: Reminder, fields: ScheduleFields) => void;
  onSetOwner: (reminder: Reminder, ownerId: string) => void;
  onOpenDelegate: (reminder: Reminder) => void;
  onOpenProject: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
  onOpenDetail: (reminder: Reminder) => void;
};

function ReminderRow({
  reminder,
  owners,
  projectName,
  columns,
  onToggle,
  onCommitTitle,
  onSchedule,
  onSetOwner,
  onOpenDelegate,
  onOpenProject,
  onDelete,
  onOpenDetail,
}: Props) {
  const scheme = useColorScheme();
  const tint = Colors[scheme].tint;
  const textColor = Colors[scheme].text;

  // null = not editing (show the underlying value)
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const recurrenceLabel = formatRecurrence(reminder.recurrence_freq, reminder.recurrence_weekday);

  function commitTitle() {
    const next = (titleDraft ?? reminder.title).trim();
    setTitleDraft(null);
    if (next && next !== reminder.title) onCommitTitle(reminder, next);
  }

  function submitSchedule() {
    const parsed = parseScheduleInput(scheduleDraft ?? '');
    if (!parsed) {
      setScheduleError(SCHEDULE_HELP);
      return;
    }
    setScheduleError(null);
    setScheduleDraft(null);
    onSchedule(reminder, {
      due_at: parsed.dueAt.toISOString(),
      recurrence_freq: parsed.recurrenceFreq,
      recurrence_weekday: parsed.recurrenceWeekday,
    });
  }

  return (
    <DraggableRow reminderId={reminder.id}>
      <View style={rowStyles.row}>
        <View style={[rowStyles.cell, rowStyles.colDone]}>
          <Pressable onPress={() => onToggle(reminder)} hitSlop={8}>
            <View
              style={[
                styles.checkbox,
                { borderColor: tint },
                reminder.completed_at && { backgroundColor: tint },
              ]}
            />
          </Pressable>
        </View>
        <View style={rowStyles.taskColumn}>
          <View style={[rowStyles.cell, rowStyles.colTask, { minWidth: columns.task }]}>
            <View style={styles.titleRow}>
              <TextInput
                style={[
                  styles.titleInput,
                  { color: textColor },
                  reminder.completed_at && styles.titleCompleted,
                ]}
                value={titleDraft ?? reminder.title}
                onChangeText={setTitleDraft}
                onBlur={commitTitle}
                onSubmitEditing={commitTitle}
                returnKeyType="done"
              />
              <Pressable onPress={() => onOpenDetail(reminder)} hitSlop={6}>
                <Text style={[styles.detailChevron, { color: tint }]}>›</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => onOpenProject(reminder)} hitSlop={4}>
              <Text style={rowStyles.rowMeta}>{projectName ?? '+ Project'}</Text>
            </Pressable>
          </View>
          <View style={rowStyles.metaRow}>
            <View style={[rowStyles.cell, rowStyles.colDue, { minWidth: columns.due }]}>
              <TextInput
                style={[rowStyles.dateInput, { color: textColor, borderColor: tint }]}
                value={scheduleDraft ?? formatDueAt(reminder.due_at) ?? ''}
                onChangeText={setScheduleDraft}
                onFocus={() => setScheduleDraft((d) => d ?? '')}
                placeholder="When"
                placeholderTextColor="#888"
                onSubmitEditing={submitSchedule}
                returnKeyType="done"
              />
              {recurrenceLabel ? <Text style={rowStyles.rowMeta}>{recurrenceLabel}</Text> : null}
              {scheduleError ? <Text style={rowStyles.error}>{scheduleError}</Text> : null}
            </View>
            <View style={[rowStyles.cell, rowStyles.colAssignee, { width: columns.assignee }]}>
              <AssigneeSelect
                value={reminder.owner_id}
                options={owners}
                onChange={(ownerId) => onSetOwner(reminder, ownerId)}
              />
            </View>
            <View style={[rowStyles.cell, rowStyles.colDelegate, { width: columns.delegate }]}>
              <Pressable
                style={styles.delegateButton}
                onPress={() => onOpenDelegate(reminder)}
                hitSlop={8}
                accessibilityLabel="Delegate">
                <Text style={styles.delegateButtonText}>🤝</Text>
              </Pressable>
            </View>
            <View style={[rowStyles.cell, rowStyles.colTrash]}>
              <Pressable onPress={() => onDelete(reminder)} hitSlop={8}>
                <Text style={styles.trashIcon}>🗑</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </DraggableRow>
  );
}

export default memo(ReminderRow);

const styles = StyleSheet.create({
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleInput: { flex: 1, fontSize: 16, paddingVertical: 2 },
  titleCompleted: { textDecorationLine: 'line-through', opacity: 0.5 },
  detailChevron: { fontSize: 20, fontWeight: '600' },
  trashIcon: { fontSize: 18 },
  delegateButton: { alignItems: 'center' },
  delegateButtonText: { fontSize: 18 },
});
