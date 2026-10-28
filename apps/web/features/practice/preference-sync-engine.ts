import type { UpdatePracticePreferencesBody } from '@vozzify/contracts';
import {
  getPracticePreferences,
  updatePracticePreferences,
} from './practice-preferences-query';
import { applyAccountPreferences, changedPreferences } from './preference-sync';
import { scoringSettings } from './stores/scoring-settings';
import { singingAidsStore } from './stores/singing-aids-store';

/**
 * The account sync behind {@link usePracticePreferencesSync}, kept free of
 * React so the rules stay testable without rendering: adopting the account
 * values on sign-in, and pushing every later store change to the account.
 * The per-Track transposition and the latency calibration never pass
 * through here.
 */
export type PreferenceSync = {
  /** Adopts the account values, once per account. */
  adopt: (userKey: string) => Promise<void>;
  /**
   * Forgets which account was adopted: the next sign-in adopts again, even
   * back into the same account, whose values a visitor may have covered on
   * this device meanwhile.
   */
  signOut: () => void;
  /** Stops pushing store changes. */
  dispose: () => void;
};

export function createPreferenceSync(
  isSignedIn: () => boolean,
): PreferenceSync {
  // What the account is known to hold: adopting and pushing both refresh it,
  // so adopting never echoes back as a write.
  const lastSent: UpdatePracticePreferencesBody = {};
  let adoptedFor: string | null = null;

  const push = (patch: UpdatePracticePreferencesBody) => {
    if (!isSignedIn()) return;
    const changed = changedPreferences(lastSent, patch);
    if (Object.keys(changed).length === 0) return;
    Object.assign(lastSent, changed);
    updatePracticePreferences(changed).catch(() => {
      // The device keeps the values; the next change tries again.
    });
  };
  const stops = [
    scoringSettings.subscribe((state) =>
      push({ difficulty: state.difficulty, octaveMode: state.octaveMode }),
    ),
    singingAidsStore.subscribe((state) =>
      push({ countIn: state.countIn, guideMelody: state.guideMelody }),
    ),
  ];

  return {
    async adopt(userKey: string) {
      if (adoptedFor === userKey) return;
      adoptedFor = userKey;
      try {
        const preferences = await getPracticePreferences();
        Object.assign(lastSent, preferences);
        applyAccountPreferences(preferences);
      } catch {
        // The device keeps its values; signing in again tries again.
        adoptedFor = null;
      }
    },
    signOut() {
      adoptedFor = null;
    },
    dispose() {
      for (const stop of stops) stop();
    },
  };
}
