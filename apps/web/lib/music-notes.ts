import { PITCH_CLASS_NAMES, type TrackNote } from '@notefinder/contracts';

/** The MIDI number of a note (`A4` is 69, `C-1` is 0). */
export function midiOf(note: Pick<TrackNote, 'note' | 'octave'>): number {
  return (note.octave + 1) * 12 + PITCH_CLASS_NAMES.indexOf(note.note);
}

/** The name of a MIDI number, as the notes write it (`C#4`). */
export function noteName(midi: number): string {
  const pitchClass = PITCH_CLASS_NAMES[((midi % 12) + 12) % 12];
  return `${pitchClass}${Math.floor(midi / 12) - 1}`;
}

/** Whether the key of this MIDI number is a black one (a sharp). */
export function isSharpKey(midi: number): boolean {
  return noteName(midi).includes('#');
}
