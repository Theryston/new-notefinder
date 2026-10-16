'use client';

import { useEffect } from 'react';
import { loadScoringSettings } from '../stores/scoring-settings';

/** Always mounted, including Tracks without notes or an open Settings menu. */
export function ScoringPreferences() {
  useEffect(loadScoringSettings, []);
  return null;
}
