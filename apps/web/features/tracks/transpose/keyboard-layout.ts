import type { TrackVocalRange } from '@notefinder/contracts';

import { isSharpKey } from '@/lib/music-notes';

import { SEMITONES_PER_OCTAVE } from './transpose';

/** The keyboard always shows at least this many octaves, so it reads as one. */
const MIN_OCTAVES = 2;

export const WHITE_KEY_WIDTH = 10;
export const WHITE_KEY_HEIGHT = 36;
export const BLACK_KEY_WIDTH = 6;
export const BLACK_KEY_HEIGHT = 22;

type KeyboardKey = {
  midi: number;
  black: boolean;
  /** Left edge in the keyboard's own units, white keys `WHITE_KEY_WIDTH` wide. */
  x: number;
  /** Whether the vocal range holds this key. */
  inRange: boolean;
};

export type KeyboardLayout = {
  /** The keyboard's width in its own units. */
  width: number;
  /** White keys first, so black ones draw over them. */
  keys: KeyboardKey[];
};

const cOf = (midi: number) =>
  Math.floor(midi / SEMITONES_PER_OCTAVE) * SEMITONES_PER_OCTAVE;

/**
 * The keys of a small keyboard that holds a vocal range: from the C at or
 * below the lowest note to the B at or above the highest, and at least two
 * octaves. Black keys sit between the two white keys they straddle.
 */
export function keyboardLayout(range: TrackVocalRange): KeyboardLayout {
  const first = Math.max(0, cOf(range.lowest));
  const octaves = Math.max(
    MIN_OCTAVES,
    Math.floor(cOf(range.highest) / SEMITONES_PER_OCTAVE) -
      first / SEMITONES_PER_OCTAVE +
      1,
  );
  const last = Math.min(127, first + octaves * SEMITONES_PER_OCTAVE - 1);
  const keys: KeyboardKey[] = [];
  let whiteKeys = 0;
  for (let midi = first; midi <= last; midi += 1) {
    const black = isSharpKey(midi);
    // A black key leans on the white key before it: centered on their edge.
    const x = black
      ? whiteKeys * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2
      : whiteKeys * WHITE_KEY_WIDTH;
    if (!black) whiteKeys += 1;
    keys.push({
      midi,
      black,
      x,
      inRange: midi >= range.lowest && midi <= range.highest,
    });
  }
  return {
    width: whiteKeys * WHITE_KEY_WIDTH,
    keys: [
      ...keys.filter((key) => !key.black),
      ...keys.filter((key) => key.black),
    ],
  };
}
