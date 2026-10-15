import type { TrackNote } from '@notefinder/contracts';

import { isSharpKey, keyOf, noteName } from '@/lib/music-notes';

import { layoutNoteLabels } from './note-label-layout';
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

export function drawLanes(
  ctx: TimelineContext,
  frame: ListenTimelineFrame,
): void {
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
export function drawBeatLines(
  ctx: TimelineContext,
  frame: ListenTimelineFrame,
): void {
  const { width, height, now, colors } = frame;
  const playheadX = playheadXOf(width, KEYBOARD_WIDTH);
  ctx.fillStyle = colors.border;
  const first = Math.ceil(xToTime(KEYBOARD_WIDTH, now, playheadX));
  const last = Math.floor(xToTime(width, now, playheadX));
  for (let second = first; second <= last; second += 1) {
    ctx.fillRect(timeToX(second, now, playheadX), 0, 1, height);
  }
}

/** Writes the note's name in the clear space reserved by the label layout. */
function drawNoteLabel(
  ctx: TimelineContext,
  note: TrackNote,
  box: NoteBox,
  style: { fill: string; fontFamily: string },
): void {
  if (!fitsLabel(box.width, box.height)) return;
  ctx.fillStyle = style.fill;
  ctx.font = `600 ${NOTE_FONT_SIZE}px ${style.fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    noteName(keyOf(note)),
    box.x + 5,
    box.y + box.height / 2,
    box.width - 8,
  );
}

export type NoteBox = { x: number; y: number; width: number; height: number };

/** Share collision-aware labels between the listening and singing rolls. */
export function drawNoteLabels(
  ctx: TimelineContext,
  frame: ListenTimelineFrame,
  fillOf: (note: TrackNote, inside: boolean) => string | null,
): void {
  const sources = visibleNoteBoxes(frame).map((source) => ({
    ...source,
    label: fillOf(source.note, true) !== null,
  }));
  for (const { note, box, inside } of layoutNoteLabels(sources, {
    left: KEYBOARD_WIDTH,
    right: frame.width,
    now: frame.now,
  })) {
    const fill = fillOf(note, inside);
    if (fill !== null) {
      drawNoteLabel(ctx, note, box, {
        fill,
        fontFamily: frame.colors.fontFamily,
      });
    }
  }
}

/** The bars of the notes that are on screen, in either mode's geometry. */
export function visibleNoteBoxes(
  frame: Pick<
    ListenTimelineFrame,
    'width' | 'height' | 'notes' | 'range' | 'now'
  >,
): { note: TrackNote; box: NoteBox }[] {
  const { width, height, notes, range, now } = frame;
  const playheadX = playheadXOf(width, KEYBOARD_WIDTH);
  const lane = laneHeight(range, height);
  const visible: { note: TrackNote; box: NoteBox }[] = [];
  for (const note of notes) {
    const x = timeToX(note.start, now, playheadX);
    const right = timeToX(note.end, now, playheadX);
    if (right < KEYBOARD_WIDTH || x > width) continue;
    visible.push({
      note,
      box: {
        x,
        y: laneTop(keyOf(note), range, height) + 1,
        width: Math.max(right - x, 2),
        height: Math.max(lane - 2, 1),
      },
    });
  }
  return visible;
}

function drawNotes(ctx: TimelineContext, frame: ListenTimelineFrame): void {
  const { now, colors } = frame;
  for (const { note, box } of visibleNoteBoxes(frame)) {
    const state = noteStateAt(note, now);
    ctx.globalAlpha = state === 'upcoming' ? UPCOMING_ALPHA : 1;
    ctx.fillStyle = state === 'past' ? colors.notePast : colors.note;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, NOTE_RADIUS);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawNoteLabels(ctx, frame, (note, inside) => {
    if (noteStateAt(note, now) === 'past') return null;
    return inside ? colors.noteLabel : colors.keyLabel;
  });
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

/** Runs `draw` clipped to the roll, so notes slide under the keyboard. */
export function drawInRoll(
  ctx: TimelineContext,
  frame: Pick<ListenTimelineFrame, 'width' | 'height'>,
  draw: () => void,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(KEYBOARD_WIDTH, 0, frame.width - KEYBOARD_WIDTH, frame.height);
  ctx.clip();
  draw();
  ctx.restore();
}

export function drawPlayhead(
  ctx: TimelineContext,
  frame: Pick<ListenTimelineFrame, 'width' | 'height' | 'colors'>,
): void {
  ctx.fillStyle = frame.colors.playhead;
  ctx.fillRect(
    playheadXOf(frame.width, KEYBOARD_WIDTH) - PLAYHEAD_WIDTH / 2,
    0,
    PLAYHEAD_WIDTH,
    frame.height,
  );
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
  ctx.save();
  drawLanes(ctx, frame);
  drawBeatLines(ctx, frame);
  drawInRoll(ctx, frame, () => drawNotes(ctx, frame));
  drawKeyboard(ctx, frame);
  drawPlayhead(ctx, frame);
  ctx.restore();
}
