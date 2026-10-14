import type { TrackNote } from '@notefinder/contracts';

import { isSharpKey, keyOf, noteName } from '@/lib/music-notes';

import {
  fitsLabel,
  type LaneRange,
  laneHeight,
  laneTop,
  noteStateAt,
  playheadXOf,
  timeToX,
  xToTime,
} from './timeline-geometry';

/** Width of the mini keyboard on the left of the roll, in CSS pixels. */
export const KEYBOARD_WIDTH = 44;

const NOTE_RADIUS = 3;
const UPCOMING_ALPHA = 0.8;
const PLAYHEAD_WIDTH = 2;
const NOTE_FONT_SIZE = 10;

/**
 * The colors of the roll, read from the design tokens (DESIGN.md "Note
 * timeline") once and again on a theme change. Canvas cannot use CSS
 * variables, so the renderer is handed the resolved values.
 */
export type TimelineColors = {
  lane: string;
  surface: string;
  border: string;
  key: string;
  keySharp: string;
  keyLabel: string;
  note: string;
  notePast: string;
  noteLabel: string;
  playhead: string;
  fontFamily: string;
};

/** The part of a canvas 2D context the roll draws with. */
export type TimelineContext = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'fillRect'
  | 'fillText'
  | 'beginPath'
  | 'roundRect'
  | 'fill'
  | 'rect'
  | 'clip'
  | 'globalAlpha'
  | 'fillStyle'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
>;

export type ListenTimelineFrame = {
  width: number;
  height: number;
  notes: readonly TrackNote[];
  range: LaneRange;
  /** The moment of the Track on the playhead, in seconds. */
  now: number;
  colors: TimelineColors;
};

function drawLanes(ctx: TimelineContext, frame: ListenTimelineFrame): void {
  const { width, height, range, colors } = frame;
  const lane = laneHeight(range, height);
  ctx.fillStyle = colors.lane;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.surface;
  for (let midi = range.low; midi <= range.high; midi += 1) {
    if (isSharpKey(midi)) {
      ctx.fillRect(
        KEYBOARD_WIDTH,
        laneTop(midi, range, height),
        width - KEYBOARD_WIDTH,
        lane,
      );
    }
  }
}

/** One faint vertical line per second of the Track. */
function drawBeatLines(ctx: TimelineContext, frame: ListenTimelineFrame): void {
  const { width, height, now, colors } = frame;
  const playheadX = playheadXOf(width, KEYBOARD_WIDTH);
  ctx.fillStyle = colors.border;
  const first = Math.ceil(xToTime(KEYBOARD_WIDTH, now, playheadX));
  const last = Math.floor(xToTime(width, now, playheadX));
  for (let second = first; second <= last; second += 1) {
    ctx.fillRect(timeToX(second, now, playheadX), 0, 1, height);
  }
}

function drawNoteLabel(
  ctx: TimelineContext,
  note: TrackNote,
  box: { x: number; y: number; width: number; height: number },
  colors: TimelineColors,
): void {
  if (!fitsLabel(box.width, box.height)) return;
  ctx.fillStyle = colors.noteLabel;
  ctx.font = `600 ${NOTE_FONT_SIZE}px ${colors.fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    noteName(keyOf(note)),
    box.x + 5,
    box.y + box.height / 2,
    box.width - 8,
  );
}

function drawNotes(ctx: TimelineContext, frame: ListenTimelineFrame): void {
  const { width, height, notes, range, now, colors } = frame;
  const playheadX = playheadXOf(width, KEYBOARD_WIDTH);
  const lane = laneHeight(range, height);
  for (const note of notes) {
    const x = timeToX(note.start, now, playheadX);
    const right = timeToX(note.end, now, playheadX);
    if (right < KEYBOARD_WIDTH || x > width) continue;
    const box = {
      x,
      y: laneTop(keyOf(note), range, height) + 1,
      width: Math.max(right - x, 2),
      height: Math.max(lane - 2, 1),
    };
    const state = noteStateAt(note, now);
    ctx.globalAlpha = state === 'upcoming' ? UPCOMING_ALPHA : 1;
    ctx.fillStyle = state === 'past' ? colors.notePast : colors.note;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, NOTE_RADIUS);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (state !== 'past') drawNoteLabel(ctx, note, box, colors);
  }
}

function drawKeyboard(ctx: TimelineContext, frame: ListenTimelineFrame): void {
  const { height, range, colors } = frame;
  const lane = laneHeight(range, height);
  for (let midi = range.low; midi <= range.high; midi += 1) {
    const top = laneTop(midi, range, height);
    ctx.fillStyle = isSharpKey(midi) ? colors.keySharp : colors.key;
    ctx.fillRect(0, top, KEYBOARD_WIDTH, lane);
    ctx.fillStyle = colors.border;
    ctx.fillRect(0, top + lane - 1, KEYBOARD_WIDTH, 1);
    // Every C names its octave, so the keyboard can be read like a piano roll.
    if (midi % 12 === 0 && lane >= NOTE_FONT_SIZE) {
      ctx.fillStyle = colors.keyLabel;
      ctx.font = `500 ${NOTE_FONT_SIZE}px ${colors.fontFamily}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(noteName(midi), KEYBOARD_WIDTH - 5, top + lane / 2);
    }
  }
  ctx.fillStyle = colors.border;
  ctx.fillRect(KEYBOARD_WIDTH - 1, 0, 1, height);
}

/**
 * Draws the roll in listen mode: lanes, one-second lines, the notes (upcoming,
 * current, past), the mini keyboard and the fixed playhead. It draws from
 * scratch every call, so any moment of the Track can be handed in; the caller
 * decides when to redraw.
 */
export function drawListenTimeline(
  ctx: TimelineContext,
  frame: ListenTimelineFrame,
): void {
  const { width, height, colors } = frame;
  ctx.save();
  drawLanes(ctx, frame);
  drawBeatLines(ctx, frame);
  ctx.save();
  ctx.beginPath();
  ctx.rect(KEYBOARD_WIDTH, 0, width - KEYBOARD_WIDTH, height);
  ctx.clip();
  drawNotes(ctx, frame);
  ctx.restore();
  drawKeyboard(ctx, frame);
  ctx.fillStyle = colors.playhead;
  ctx.fillRect(
    playheadXOf(width, KEYBOARD_WIDTH) - PLAYHEAD_WIDTH / 2,
    0,
    PLAYHEAD_WIDTH,
    height,
  );
  ctx.restore();
}
