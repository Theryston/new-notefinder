import type { TrackVocalRange } from '@notefinder/contracts';

const LOWEST_MIDI = 0;
const HIGHEST_MIDI = 127;

/**
 * The lowest and highest key a set of notes reaches, or null without notes. A
 * pitch between two keys counts for the nearest one, as the notes' names do,
 * and the range stays inside the MIDI scale the contract speaks.
 */
export function vocalRangeOf(
  notes: readonly { pitch: number }[],
): TrackVocalRange | null {
  if (notes.length === 0) {
    return null;
  }
  const keys = notes.map((note) =>
    Math.min(HIGHEST_MIDI, Math.max(LOWEST_MIDI, Math.floor(note.pitch + 0.5))),
  );
  return { lowest: Math.min(...keys), highest: Math.max(...keys) };
}
