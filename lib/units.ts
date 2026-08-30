// Radius is stored canonically in meters; the UI shows/accepts the user's
// locale measurement unit. Conversion happens only at the input edge.

export const M_PER_FT = 0.3048;

export type UnitSystem = 'metric' | 'imperial';

// expo-localization measurementSystem is 'metric' | 'us' | 'uk' | null.
// 'uk' keeps meters for short distances; only 'us' means feet here.
export function unitSystemFrom(measurementSystem: string | null | undefined): UnitSystem {
  return measurementSystem === 'us' ? 'imperial' : 'metric';
}

export function radiusUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'ft' : 'm';
}

/** Canonical meters → a tidy value in the display unit (feet rounded to 10s). */
export function metersToDisplay(meters: number, system: UnitSystem): number {
  if (system === 'imperial') return Math.round(meters / M_PER_FT / 10) * 10;
  return Math.round(meters);
}

/** Display-unit value → canonical integer meters. NaN if not finite. */
export function displayToMeters(value: number, system: UnitSystem): number {
  if (!Number.isFinite(value)) return NaN;
  return Math.round(system === 'imperial' ? value * M_PER_FT : value);
}

/** Label for a value already in display units. */
export function formatRadiusDisplay(value: number, system: UnitSystem): string {
  return `${Math.round(value)} ${radiusUnitLabel(system)}`;
}

export function formatRadius(meters: number, system: UnitSystem): string {
  return formatRadiusDisplay(metersToDisplay(meters, system), system);
}

/** Slider bounds in the display unit: 150–1000 ft, or 50–300 m. */
export function radiusSliderConfig(system: UnitSystem): { min: number; max: number; step: number } {
  return system === 'imperial' ? { min: 150, max: 1000, step: 10 } : { min: 50, max: 300, step: 10 };
}
