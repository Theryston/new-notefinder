import { nearestKey, type TrackVocalRange } from '@vozzify/contracts';

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
    Math.min(HIGHEST_MIDI, Math.max(LOWEST_MIDI, nearestKey(note.pitch))),
  );
  return { lowest: Math.min(...keys), highest: Math.max(...keys) };
}
