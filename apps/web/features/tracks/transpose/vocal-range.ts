import type { TrackVocalRange } from '@notefinder/contracts';

import { noteName } from '@/lib/music-notes';

import { SEMITONES_PER_OCTAVE } from './transpose';

/**
 * What the vocal range line says: the lowest and highest note names, and the
 * span in octaves to one decimal (`D4–D5` is 1, `D4–A5` is 1.6).
 */
export function describeRange(range: TrackVocalRange): {
  low: string;
  high: string;
  octaves: number;
} {
  const span = (range.highest - range.lowest) / SEMITONES_PER_OCTAVE;
  return {
    low: noteName(range.lowest),
    high: noteName(range.highest),
    octaves: Math.round(span * 10) / 10,
  };
}
