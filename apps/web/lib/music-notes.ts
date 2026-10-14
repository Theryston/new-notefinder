import { nearestKey, pitchName, type TrackNote } from '@notefinder/contracts';

/** The key of a note: the MIDI number nearest to its pitch (`A4` is 69). */
export function keyOf(note: Pick<TrackNote, 'pitch'>): number {
  return nearestKey(note.pitch);
}

/** The name of the key nearest to a pitch, as notes write it (`C#4`). */
export function noteName(pitch: number): string {
  return pitchName(pitch);
}

/** Whether the key of this MIDI number is a black one (a sharp). */
export function isSharpKey(midi: number): boolean {
  return noteName(midi).includes('#');
}
