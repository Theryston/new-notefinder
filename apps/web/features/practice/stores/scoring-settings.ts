'use client';

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { defaultScoring, type ScoringSettings } from '../scoring';

const KEY = 'notefinder.scoring.v1';
export const scoringSettings = createStore<ScoringSettings>(
  () => defaultScoring,
);

export function loadScoringSettings(): void {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return;
    scoringSettings.setState({
      difficulty:
        'difficulty' in raw &&
        (raw.difficulty === 'EASY' || raw.difficulty === 'HARD')
          ? raw.difficulty
          : 'NORMAL',
      octaveMode:
        'octaveMode' in raw && raw.octaveMode === 'EXACT' ? 'EXACT' : 'ANY',
    });
  } catch {
    // Device storage can be unavailable; in-memory settings still work.
  }
}

export function saveScoringSettings(settings: Partial<ScoringSettings>): void {
  scoringSettings.setState(settings);
  try {
    localStorage.setItem(KEY, JSON.stringify(scoringSettings.getState()));
  } catch {
    // Preserve this visit's settings if device storage is unavailable.
  }
}

export function useScoringSettings<T>(selector: (state: ScoringSettings) => T) {
  return useStore(scoringSettings, selector);
}
