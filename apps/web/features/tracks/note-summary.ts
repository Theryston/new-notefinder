import type { TrackNote } from '@vozzify/contracts';

import { keyOf, noteName } from '@/lib/music-notes';

/** The notes a Track sings, once each, from the lowest to the highest. */
export function distinctNoteNames(
  notes: readonly TrackNote[],
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const midis = [...new Set(notes.map(keyOf))].sort((a, b) => a - b);
  return midis.slice(0, limit).map(noteName);
}

/** The lowest and highest note of a Track, or null without notes. */
export function noteRangeOf(
  notes: readonly TrackNote[],
): { low: string; high: string } | null {
  const names = distinctNoteNames(notes);
  const low = names[0];
  const high = names.at(-1);
  return low === undefined || high === undefined ? null : { low, high };
}
