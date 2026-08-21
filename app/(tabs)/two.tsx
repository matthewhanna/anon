import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/lib/auth-context';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Signed in as</Text>
      <Text style={styles.email}>{session?.user.email}</Text>
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  label: {
    opacity: 0.6,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#e53e3e',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
