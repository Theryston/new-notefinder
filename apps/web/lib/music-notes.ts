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

/** A Vocal range as cards write it (`D3–A4`): the lowest and highest key. */
export function rangeName(lowest: number, highest: number): string {
  return `${noteName(lowest)}–${noteName(highest)}`;
}

/**
 * The compass a range bar draws on: the piano's A0 (21) to C8 (108), so every
 * Track's bar shares one scale and bars stay comparable across cards.
 */
export const RANGE_BAR_LOWEST = 21;
export const RANGE_BAR_HIGHEST = 108;

/**
 * Where a Vocal range sits on the bar, as percentages of its width: `left`
 * is the range's start, `width` its span, both clamped to the compass. A
 * single key still draws, with a zero width the caller floors to a hairline.
 */
export function rangeBarGeometry(
  lowest: number,
  highest: number,
): { leftPercent: number; widthPercent: number } {
  const span = RANGE_BAR_HIGHEST - RANGE_BAR_LOWEST;
  const start = Math.min(Math.max(lowest, RANGE_BAR_LOWEST), RANGE_BAR_HIGHEST);
  const end = Math.min(Math.max(highest, RANGE_BAR_LOWEST), RANGE_BAR_HIGHEST);
  return {
    leftPercent: ((start - RANGE_BAR_LOWEST) / span) * 100,
    widthPercent: ((Math.max(end, start) - start) / span) * 100,
  };
}
