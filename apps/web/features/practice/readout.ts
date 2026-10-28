import type { TrackNote } from '@vozzify/contracts';

import { keyOf, noteName } from '@/lib/music-notes';

/**
 * The note sung at `time` (the one whose span holds it), or null in a rest.
 * Notes come in the order they are sung, so a binary search finds it without
 * walking thousands of notes every frame.
 */
function targetNoteAt(
  notes: readonly TrackNote[],
  time: number,
): TrackNote | null {
  let low = 0;
  let high = notes.length - 1;
  let found: TrackNote | null = null;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const note = notes[middle];
    if (!note) return null;
    if (note.start <= time) {
      found = note;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found && found.end > time ? found : null;
}

/** The name (`C#4`) of the target note at `time`, or null in a rest. */
export function targetNameAt(
  notes: readonly TrackNote[],
  time: number,
): string | null {
  const note = targetNoteAt(notes, time);
  return note ? noteName(keyOf(note)) : null;
}

/** The name of the key nearest to what the user is singing, or null. */
export function detectedName(midi: number | null): string | null {
  return midi === null ? null : noteName(Math.round(midi));
}
