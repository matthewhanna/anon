import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

export type ColumnWidths = {
  task: number;
  due: number;
  assignee: number;
  delegate: number;
};

export function useColumnWidths(): ColumnWidths {
  const { width } = useWindowDimensions();
  const narrow = width < 600;
  return useMemo(
    () => ({
      task: narrow ? 90 : 110,
      due: narrow ? 100 : 130,
      assignee: narrow ? 100 : 130,
      delegate: 32,
    }),
    [narrow]
  );
}

// Row/column layout shared by ReminderRow and AddReminderRow.
export const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  taskColumn: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  cell: { justifyContent: 'center' },
  colDone: { width: 28, alignItems: 'center' },
  colTask: { flex: 3 },
  colDue: { flex: 2 },
  colAssignee: {},
  colDelegate: {},
  colTrash: { width: 32, alignItems: 'center' },
  dateInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  rowMeta: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  error: { color: '#e53e3e', marginBottom: 8 },
});
