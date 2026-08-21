import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type Option = { id: string; name: string };

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

  return (
    <>
      <Pressable style={[styles.button, { borderColor: tintColor }]} onPress={() => setIsOpen(true)}>
        <Text style={styles.buttonText}>{currentLabel} ▾</Text>
      </Pressable>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.card}>
            {options.map((option) => (
              <Pressable
                key={option.id}
                style={styles.option}
                onPress={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}>
                <Text style={styles.optionText}>{option.name}</Text>
              </Pressable>
            ))}
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
  option: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  optionText: {
    fontSize: 16,
  },
});
