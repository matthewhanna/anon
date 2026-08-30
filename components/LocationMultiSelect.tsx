import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Location } from '@/lib/locations';

export default function LocationMultiSelect({
  locations,
  selectedIds,
  onChange,
}: {
  locations: Location[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const scheme = useColorScheme();
  const accent = Colors[scheme].accent;
  const border = scheme === 'dark' ? '#2a2a2a' : '#e2e2e2';
  const muted = scheme === 'dark' ? '#9aa0a6' : '#6b7280';

  if (locations.length === 0) {
    return <Text style={{ color: muted }}>No locations yet — add one in Settings.</Text>;
  }

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <View style={styles.wrap}>
      {locations.map((loc) => {
        const on = selectedIds.includes(loc.id);
        return (
          <Pressable
            key={loc.id}
            onPress={() => toggle(loc.id)}
            style={[
              styles.chip,
              { borderColor: on ? accent : border, backgroundColor: on ? `${accent}22` : 'transparent' },
            ]}
          >
            <Text style={{ color: on ? accent : muted, fontWeight: on ? '600' : '400' }}>{loc.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
});
