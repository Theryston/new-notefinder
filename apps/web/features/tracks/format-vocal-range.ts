import type { VocalRange } from '@notefinder/contracts';

/** Scientific pitch notation, as singers read it: `E2–A4`. */
export function formatVocalRange({ lowest, highest }: VocalRange): string {
  return `${lowest.note}${lowest.octave}–${highest.note}${highest.octave}`;
}
