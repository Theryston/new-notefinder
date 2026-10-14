import type {
  TrackKey,
  TrackNote,
  TrackVocalRange,
} from '@notefinder/contracts';

export const SEMITONES_PER_OCTAVE = 12;

/** How far the stepper moves the Track: an octave down to an octave up. */
export const MIN_TRANSPOSE = -12;
export const MAX_TRANSPOSE = 12;

/** A transposition the stepper can hold: whole semitones inside its limits. */
export function clampTranspose(semitones: number): number {
  if (!Number.isFinite(semitones)) return 0;
  return Math.min(
    MAX_TRANSPOSE,
    Math.max(MIN_TRANSPOSE, Math.round(semitones)),
  );
}

/**
 * The notes moved by whole semitones. Untransposed notes come back as they
 * are, so the timeline is not redrawn from new arrays for nothing.
 */
export function transposeNotes<Note extends TrackNote>(
  notes: readonly Note[],
  semitones: number,
): readonly Note[] {
  if (semitones === 0) return notes;
  return notes.map((note) => ({ ...note, pitch: note.pitch + semitones }));
}

/** The key a transposed Track is in: the tonic moves, the mode stays. */
export function transposeKey(key: TrackKey, semitones: number): TrackKey {
  return {
    ...key,
    tonic:
      (((key.tonic + semitones) % SEMITONES_PER_OCTAVE) +
        SEMITONES_PER_OCTAVE) %
      SEMITONES_PER_OCTAVE,
  };
}

/** The vocal range a transposed Track has. */
export function transposeRange(
  range: TrackVocalRange,
  semitones: number,
): TrackVocalRange {
  return {
    lowest: range.lowest + semitones,
    highest: range.highest + semitones,
  };
}
