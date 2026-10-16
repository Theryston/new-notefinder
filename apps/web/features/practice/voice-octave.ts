import type { TrackNote } from '@notefinder/contracts';

/** Shifts a sung pitch by whole octaves onto a reference pitch. */
export function foldVoiceOctave(midi: number, reference: number): number {
  return midi + 12 * Math.round((reference - midi) / 12);
}

/**
 * The pitch the voice line folds onto at a moment: the note under it, else
 * the nearest note. Null when there is nothing to fold onto.
 */
export function foldReference(
  notes: readonly TrackNote[],
  time: number,
): number | null {
  const active = notes.find((note) => note.start <= time && time < note.end);
  if (active) return active.pitch;
  let best: TrackNote | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const note of notes) {
    const distance = time < note.start ? note.start - time : time - note.end;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = note;
    }
  }
  return best?.pitch ?? null;
}
