import { beforeEach, expect, it, vi } from 'vitest';
import { defaultScoring } from '../scoring';
import {
  loadScoringSettings,
  saveScoringSettings,
  scoringSettings,
} from './scoring-settings';

let saved: string | null = null;
beforeEach(() => {
  saved = null;
  scoringSettings.setState(defaultScoring);
  vi.stubGlobal('localStorage', {
    getItem: () => saved,
    setItem: (_key: string, value: string) => {
      saved = value;
    },
  });
});

it('loads the stored difficulty and octave mode', () => {
  saved = JSON.stringify({ difficulty: 'HARD', octaveMode: 'EXACT' });

  loadScoringSettings();

  expect(scoringSettings.getState()).toEqual({
    difficulty: 'HARD',
    octaveMode: 'EXACT',
  });
});

it('falls back to the defaults for values it does not know', () => {
  saved = JSON.stringify({ difficulty: 'INSANE', octaveMode: 'LOOSE' });

  loadScoringSettings();

  expect(scoringSettings.getState()).toEqual(defaultScoring);
});

it('keeps the current settings when the stored value is not an object', () => {
  saved = 'null';

  loadScoringSettings();

  expect(scoringSettings.getState()).toEqual(defaultScoring);
});

it('keeps the settings in memory when device storage is unavailable', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
  });

  expect(() => loadScoringSettings()).not.toThrow();
  expect(scoringSettings.getState()).toEqual(defaultScoring);
});

it('saves the merged settings to device storage', () => {
  saveScoringSettings({ octaveMode: 'EXACT' });

  expect(scoringSettings.getState()).toEqual({
    difficulty: 'NORMAL',
    octaveMode: 'EXACT',
  });
  expect(JSON.parse(saved ?? 'null')).toEqual({
    difficulty: 'NORMAL',
    octaveMode: 'EXACT',
  });
});

it('keeps the new settings in memory when device storage is unavailable', () => {
  vi.stubGlobal('localStorage', {
    setItem: () => {
      throw new Error('quota');
    },
  });

  expect(() => saveScoringSettings({ difficulty: 'EASY' })).not.toThrow();
  expect(scoringSettings.getState().difficulty).toBe('EASY');
});
