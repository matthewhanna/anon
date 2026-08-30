import { Image, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';

// Header title: logo + "Anon", optionally followed by a tappable
// " — <location> ▾" that opens the location/room chooser.
export default function BrandTitle({
  suffix,
  onPress,
}: {
  suffix?: string | null;
  onPress?: () => void;
}) {
  const scheme = useColorScheme();
  const muted = scheme === 'dark' ? '#9aa0a6' : '#6b7280';

  return (
    <View style={styles.wrap}>
      <Image source={require('../assets/images/logo.png')} style={styles.logo} />
      <Text style={styles.brand}>Anon</Text>
      {suffix != null ? (
        <Pressable onPress={onPress} hitSlop={8} style={styles.suffixBtn}>
          <Text style={[styles.suffix, { color: muted }]} numberOfLines={1}>
            {` — ${suffix} ▾`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', maxWidth: 280 },
  logo: { width: 24, height: 24, marginRight: 6 },
  brand: { fontSize: 17, fontWeight: '600' },
  suffixBtn: { flexShrink: 1 },
  suffix: { fontSize: 15, fontWeight: '500' },
});
