import type { TrackNote } from '@notefinder/contracts';

import { midiOf } from '@/lib/music-notes';

/** Where the playhead sits in the roll, as a share of its width (DESIGN.md). */
export const PLAYHEAD_RATIO = 0.4;

/** Horizontal scale of the roll: how many pixels one second takes. */
export const PIXELS_PER_SECOND = 96;

/** The fewest lanes a roll shows, so a one-note Track is not a single fat bar. */
const MIN_LANES = 13;

/** Lanes kept above and below the Track's range. */
const LANE_PADDING = 1;

/** The smallest bar that has room for its note name, and the smallest lane. */
const LABEL_MIN_BAR_WIDTH = 30;
const LABEL_MIN_LANE_HEIGHT = 10;

/** The lanes of the roll: MIDI numbers, both ends included. */
export type LaneRange = { low: number; high: number };

/**
 * The lanes that fit the Track's range, with a lane of room on each side and at
 * least {@link MIN_LANES} of them (a Track with no notes rests on C4 to C5).
 */
export function laneRangeOf(notes: readonly TrackNote[]): LaneRange {
  const midis = notes.map(midiOf);
  if (midis.length === 0) {
    return { low: 60 - LANE_PADDING, high: 72 + LANE_PADDING };
  }
  let low = Math.min(...midis) - LANE_PADDING;
  let high = Math.max(...midis) + LANE_PADDING;
  for (let missing = MIN_LANES - (high - low + 1); missing > 0; missing -= 1) {
    // Alternate sides, so a short range stays centered in the roll.
    if (missing % 2 === 1) low -= 1;
    else high += 1;
  }
  return { low: Math.max(0, low), high: Math.min(127, high) };
}

/** How many lanes the range has. */
export function laneCount(range: LaneRange): number {
  return range.high - range.low + 1;
}

/** The height of one lane in a roll of this height. */
export function laneHeight(range: LaneRange, height: number): number {
  return height / laneCount(range);
}

/** The top edge of the lane of this MIDI number; higher notes are higher up. */
export function laneTop(
  midi: number,
  range: LaneRange,
  height: number,
): number {
  return (range.high - midi) * laneHeight(range, height);
}

/** The MIDI number of the lane at this y, or null outside the roll. */
export function midiAtY(
  y: number,
  range: LaneRange,
  height: number,
): number | null {
  if (y < 0 || y >= height) return null;
  return range.high - Math.floor(y / laneHeight(range, height));
}

/** The x of the fixed playhead in a roll of this width, after the keyboard. */
export function playheadXOf(width: number, keyboardWidth: number): number {
  return keyboardWidth + (width - keyboardWidth) * PLAYHEAD_RATIO;
}

/** The x a moment of the Track is drawn at while `now` sits on the playhead. */
export function timeToX(time: number, now: number, playheadX: number): number {
  return playheadX + (time - now) * PIXELS_PER_SECOND;
}

/** The moment of the Track drawn at this x; the inverse of {@link timeToX}. */
export function xToTime(x: number, now: number, playheadX: number): number {
  return now + (x - playheadX) / PIXELS_PER_SECOND;
}

export type NoteState = 'past' | 'current' | 'upcoming';

/** Whether a note is behind the playhead, under it, or still to come. */
export function noteStateAt(
  note: Pick<TrackNote, 'start' | 'end'>,
  now: number,
): NoteState {
  if (note.end <= now) return 'past';
  if (note.start <= now) return 'current';
  return 'upcoming';
}

/** Whether a bar and its lane are big enough to write the note name in. */
export function fitsLabel(barWidth: number, lane: number): boolean {
  return barWidth >= LABEL_MIN_BAR_WIDTH && lane >= LABEL_MIN_LANE_HEIGHT;
}
