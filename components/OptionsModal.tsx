import { Modal, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export type ModalOption = { id: string; label: string };

// A fade-in card with a title and a tappable list of options. Used for the
// per-task "delegate" and "move to project" pickers.
export default function OptionsModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: ModalOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {options.map((option) => (
            <Pressable key={option.id} style={styles.option} onPress={() => onSelect(option.id)}>
              <Text style={styles.optionText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: { borderRadius: 12, padding: 16, minWidth: 220, gap: 2 },
  title: { fontSize: 13, fontWeight: '700', opacity: 0.6, marginBottom: 8 },
  option: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 6 },
  optionText: { fontSize: 16 },
});
