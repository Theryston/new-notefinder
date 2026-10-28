import type {
  PracticePreferences,
  UpdatePracticePreferencesBody,
} from '@vozzify/contracts';

import { saveScoringSettings } from './stores/scoring-settings';
import { saveSingingAids } from './stores/singing-aids-store';

/**
 * The entries of a store change the account does not hold yet. Adopting the
 * account and pushing a change both move through here, so adopting never
 * echoes back as a write.
 */
export function changedPreferences(
  known: UpdatePracticePreferencesBody,
  patch: UpdatePracticePreferencesBody,
): UpdatePracticePreferencesBody {
  return Object.fromEntries(
    Object.entries(patch).filter(
      ([key, value]) =>
        known[key as keyof UpdatePracticePreferencesBody] !== value,
    ),
  );
}

/**
 * Writes the account values into the stores (and the device copies): signing
 * in adopts them. The latency calibration and the guide's manual mark stay
 * untouched: they never leave the device.
 */
export function applyAccountPreferences(
  preferences: PracticePreferences,
): void {
  saveScoringSettings({
    difficulty: preferences.difficulty,
    octaveMode: preferences.octaveMode,
  });
  saveSingingAids({
    countIn: preferences.countIn,
    guideMelody: preferences.guideMelody,
  });
}
