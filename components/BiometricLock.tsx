import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  getBiometricLockEnabled,
  isBiometricAvailable,
  subscribeBiometricLockEnabled,
} from '@/lib/biometric-lock';

/**
 * Gates its children behind Face ID / Touch ID when the setting is on, and
 * re-locks whenever the app is fully backgrounded. Renders children straight
 * through (no-op) if the setting is off or the device has no usable
 * biometric enrolled -- this only ever locks something already unlocked by a
 * real Supabase session; it never replaces sign-in.
 */
export default function BiometricLock({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const [enabled, setEnabled] = useState(getBiometricLockEnabled);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(enabled);
  const [authenticating, setAuthenticating] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => subscribeBiometricLockEnabled(setEnabled), []);

  useEffect(() => {
    let cancelled = false;
    isBiometricAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reflect the enabled/available gate; the effect below re-locks on backgrounding.
  useEffect(() => {
    setLocked(enabled && available !== false);
  }, [enabled, available]);

  // Re-lock only on a true background transition, not the transient
  // "inactive" state (app switcher preview, share sheets, permission
  // prompts) -- those would otherwise trigger a Face ID prompt constantly.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current === 'active' && next === 'background' && enabled && available) {
        setLocked(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [enabled, available]);

  async function unlock() {
    setAuthenticating(true);
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Anon' });
    setAuthenticating(false);
    if (result.success) setLocked(false);
  }

  // Prompt immediately on lock rather than waiting for a tap.
  useEffect(() => {
    if (locked && !authenticating) void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  if (!enabled || available === false || !locked) {
    return <>{children}</>;
  }

  const tint = Colors[scheme].tint;
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      {authenticating ? (
        <ActivityIndicator />
      ) : (
        <Pressable style={[styles.button, { backgroundColor: tint }]} onPress={unlock}>
          <Text style={[styles.buttonText, { color: Colors[scheme].background }]}>Unlock</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  icon: { fontSize: 48 },
  button: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { fontWeight: '600', fontSize: 16 },
});
