// Face ID / Touch ID app-lock preference. Device-local (localStorage), off by
// default. This is NOT a login method -- it doesn't change how you sign in or
// how long the Supabase session lasts. It just gates *revealing* an already
// signed-in session behind a biometric check when the app is opened.

import * as LocalAuthentication from 'expo-local-authentication';

const KEY = 'anon.biometricLockEnabled';

let cached: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function getBiometricLockEnabled(): boolean {
  if (cached === null) cached = read();
  return cached;
}

export function setBiometricLockEnabled(value: boolean): void {
  cached = value;
  try {
    globalThis.localStorage?.setItem(KEY, value ? '1' : '0');
  } catch {
    // best-effort; in-memory value still applies this session
  }
  for (const fn of listeners) fn(value);
}

export function subscribeBiometricLockEnabled(fn: (v: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Hardware present AND at least one biometric enrolled on this device. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}
