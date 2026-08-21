import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type Option = { id: string; name: string; is_individual: boolean };

type Props = {
  value: string;
  options: Option[];
  onChange: (id: string) => void;
};

export default function AssigneeSelect({ value, options, onChange }: Props) {
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme].tint;
  const [isOpen, setIsOpen] = useState(false);
  const currentLabel = options.find((option) => option.id === value)?.name ?? '—';
  const people = options.filter((option) => option.is_individual);
  const groups = options.filter((option) => !option.is_individual);

  function renderOption(option: Option) {
    return (
      <Pressable
        key={option.id}
        style={styles.option}
        onPress={() => {
          onChange(option.id);
          setIsOpen(false);
        }}>
        <Text style={styles.optionText}>{option.name}</Text>
      </Pressable>
    );
  }

  return (
    <>
      <Pressable style={[styles.button, { borderColor: tintColor }]} onPress={() => setIsOpen(true)}>
        <Text style={styles.buttonText}>{currentLabel} ▾</Text>
      </Pressable>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.card}>
            {people.length > 0 && (
              <>
                <Text style={styles.groupLabel}>People</Text>
                {people.map(renderOption)}
              </>
            )}
            {groups.length > 0 && (
              <>
                <Text style={styles.groupLabel}>Groups</Text>
                {groups.map(renderOption)}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buttonText: {
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    gap: 2,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  optionText: {
    fontSize: 16,
  },
});
