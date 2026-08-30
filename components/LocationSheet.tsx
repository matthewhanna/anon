import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useLocationContext } from '@/lib/location-context';

// Shared bottom-sheet chooser for the active location + room. Rendered once at
// the tabs layout; opened via context.setPickerOpen from any tab's header.
export default function LocationSheet() {
  const scheme = useColorScheme();
  const tint = Colors[scheme].tint;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    locations,
    rooms,
    activeLocationId,
    activeRoomId,
    setActiveLocationId,
    setActiveRoomId,
    pickerOpen,
    setPickerOpen,
  } = useLocationContext();

  return (
    <Modal
      visible={pickerOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setPickerOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: Colors[scheme].background, paddingBottom: insets.bottom + 16 },
          ]}
          onPress={() => {}}>
          <View style={styles.grabber} />

          <Text style={styles.label}>Location</Text>
          {locations.map((loc) => (
            <Pressable
              key={loc.id}
              style={styles.optionRow}
              onPress={() => {
                setActiveLocationId(loc.id);
                setPickerOpen(false);
              }}>
              <Text style={styles.optionText}>{loc.name}</Text>
              {loc.id === activeLocationId ? <Text style={{ color: tint }}>✓</Text> : null}
            </Pressable>
          ))}

          {rooms.length > 0 ? (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>Room</Text>
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setActiveRoomId(null);
                  setPickerOpen(false);
                }}>
                <Text style={styles.optionText}>All rooms</Text>
                {activeRoomId === null ? <Text style={{ color: tint }}>✓</Text> : null}
              </Pressable>
              {rooms.map((room) => (
                <Pressable
                  key={room.id}
                  style={styles.optionRow}
                  onPress={() => {
                    setActiveRoomId(room.id);
                    setPickerOpen(false);
                  }}>
                  <Text style={styles.optionText}>{room.name}</Text>
                  {room.id === activeRoomId ? <Text style={{ color: tint }}>✓</Text> : null}
                </Pressable>
              ))}
            </>
          ) : null}

          <Pressable
            style={styles.manage}
            onPress={() => {
              setPickerOpen(false);
              router.push('/two');
            }}>
            <Text style={{ color: tint }}>Manage locations &amp; rooms</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 2,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8886',
    marginBottom: 10,
  },
  label: { fontSize: 13, fontWeight: '700', opacity: 0.6, marginBottom: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  optionText: { fontSize: 16 },
  manage: { marginTop: 16, paddingHorizontal: 8, paddingVertical: 6 },
});
