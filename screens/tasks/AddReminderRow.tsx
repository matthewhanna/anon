import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import AssigneeSelect from '@/components/AssigneeSelect';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Owner } from '@/lib/owners';
import { rowStyles, type ColumnWidths } from '@/screens/tasks/columns';

export type AddReminderInput = {
  title: string;
  scheduleText: string;
  assigneeId: string | null;
};

type Props = {
  assignableOwners: Owner[];
  myOwnerId: string | null;
  columns: ColumnWidths;
  disabled: boolean;
  onAdd: (input: AddReminderInput) => Promise<{ scheduleError: string | null }>;
};

export default function AddReminderRow({
  assignableOwners,
  myOwnerId,
  columns,
  disabled,
  onAdd,
}: Props) {
  const scheme = useColorScheme();
  const tint = Colors[scheme].tint;
  const textColor = Colors[scheme].text;

  const [title, setTitle] = useState('');
  const [scheduleText, setScheduleText] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const canSubmit = title.trim().length > 0 && !disabled;

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || disabled) return;
    setTitle('');
    const { scheduleError: err } = await onAdd({
      title: trimmed,
      scheduleText: scheduleText.trim(),
      assigneeId,
    });
    setScheduleError(err);
    setScheduleText('');
    setAssigneeId(null);
  }

  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.taskColumn}>
        <View style={[rowStyles.cell, rowStyles.colTask, { minWidth: columns.task }]}>
          <TextInput
            style={[styles.titleInput, { color: textColor }]}
            value={title}
            onChangeText={setTitle}
            placeholder="New reminder"
            placeholderTextColor="#888"
            editable={!disabled}
            onSubmitEditing={submit}
            returnKeyType="done"
          />
        </View>
        <View style={rowStyles.metaRow}>
          <View style={[rowStyles.cell, rowStyles.colDue, { minWidth: columns.due }]}>
            <TextInput
              style={[rowStyles.dateInput, { color: textColor, borderColor: tint }]}
              value={scheduleText}
              onChangeText={setScheduleText}
              placeholder="When"
              placeholderTextColor="#888"
              editable={!disabled}
              onSubmitEditing={submit}
              returnKeyType="done"
            />
            {scheduleError ? <Text style={rowStyles.error}>{scheduleError}</Text> : null}
          </View>
          <View style={[rowStyles.cell, rowStyles.colAssignee, { width: columns.assignee }]}>
            {assignableOwners.length > 0 && (myOwnerId || assigneeId) ? (
              <AssigneeSelect
                value={assigneeId ?? myOwnerId ?? ''}
                options={assignableOwners}
                onChange={setAssigneeId}
              />
            ) : null}
          </View>
          <View style={[rowStyles.cell, rowStyles.colDelegate, { width: columns.delegate }]} />
          <View style={[rowStyles.cell, rowStyles.colTrash]}>
            {/* The keyboard return key submits too, but iOS doesn't reliably fire
                onSubmitEditing for a TextInput in a list header, so give it a
                real button rather than depending on that alone. */}
            <Pressable onPress={submit} disabled={!canSubmit} hitSlop={8}>
              <Text style={[styles.addIcon, !canSubmit && styles.addIconDisabled, { color: tint }]}>
                ➕
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleInput: { fontSize: 16, flexShrink: 1 },
  addIcon: { fontSize: 18 },
  addIconDisabled: { opacity: 0.3 },
});
