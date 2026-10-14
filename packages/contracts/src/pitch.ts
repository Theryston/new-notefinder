/** The twelve pitch class names, sharps as `#`. */
export const PITCH_CLASS_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

/**
 * The key nearest to a pitch, as a MIDI number (`60.4` is `60`). A pitch halfway
 * between two keys goes to the higher one.
 */
export function nearestKey(pitch: number): number {
  return Math.floor(pitch + 0.5);
}

/**
 * The name of the key nearest to a pitch: the pitch class (sharps as `#`) and
 * the octave in MIDI numbering (`A4` is 69, `C-1` is 0), as in `C#4`.
 */
export function pitchName(pitch: number): string {
  const key = nearestKey(pitch);
  const pitchClass = PITCH_CLASS_NAMES[((key % 12) + 12) % 12];
  return `${pitchClass}${Math.floor(key / 12) - 1}`;
}
