import { estimateKey } from './track-key.js';
import type { NoteSpan } from './track-note-span.js';
import { vocalRangeOf } from './track-vocal-range.js';

/**
 * The columns a Track keeps of its notes, the vocal range and the estimated
 * key, all null for a Track without notes. A Processing writes them when it
 * replaces the notes, and the backfill writes them for the Tracks completed
 * before they existed.
 */
export function noteSummaryOf(notes: readonly NoteSpan[]) {
  const range = vocalRangeOf(notes);
  const key = estimateKey(notes);
  return {
    vocalRangeLowest: range?.lowest ?? null,
    vocalRangeHighest: range?.highest ?? null,
    keyTonic: key?.tonic ?? null,
    keyMode: key?.mode ?? null,
  };
}
