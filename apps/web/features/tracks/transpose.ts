import type { TrackNote } from '@notefinder/contracts';

/** Moves the displayed vocal line by a whole number of semitones. */
export function transposeNotes(
  notes: readonly TrackNote[],
  semitones: number,
): TrackNote[] {
  if (semitones === 0) return [...notes];
  return notes.map((note) => ({ ...note, pitch: note.pitch + semitones }));
}

export function transposePitchClass(pitchClass: number, semitones: number) {
  return (((pitchClass + semitones) % 12) + 12) % 12;
}
