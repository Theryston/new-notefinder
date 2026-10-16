import type { TrackNote } from '@notefinder/contracts';

import { noteName } from '@/lib/music-notes';
import {
  drawBeatLines,
  drawInRoll,
  drawLanes,
  drawNoteLabels,
  drawPlayhead,
  KEYBOARD_WIDTH,
  type NoteBox,
  type TimelineColors,
  type TimelineContext,
  visibleNoteBoxes,
} from './draw-listen-timeline';
import { singFocusKey, singLaneRange } from './sing-lanes';
import {
  type LaneRange,
  laneHeight,
  laneTop,
  noteStateAt,
  playheadXOf,
  timeToX,
  xToTime,
} from './timeline-geometry';

/** A stretch of the user's voice: where it was and how high, in MIDI. */
export type VoicePoint = { time: number; midi: number };

/**
 * Where the roll gets the user's voice. The stretches are connected lines
 * (silence ends one and starts the next, so it shows as a gap).
 */
export type VoiceSource = {
  segments(from: number, to: number): VoicePoint[][];
  judgment?(note: TrackNote): 'hit' | 'near' | 'miss' | null;
  subscribe(listener: () => void): () => void;
};

/** Sing mode adds the muted and voice tokens to the listen mode's colors. */
export type SingTimelineColors = TimelineColors & {
  muted: string;
  mutedLine: string;
  mutedLabel: string;
  current: string;
  voice: string;
  hit?: string;
  near?: string;
  miss?: string;
};

export type SingTimelineContext = TimelineContext &
  Pick<
    CanvasRenderingContext2D,
    | 'stroke'
    | 'moveTo'
    | 'lineTo'
    | 'strokeStyle'
    | 'lineWidth'
    | 'lineCap'
    | 'lineJoin'
    | 'strokeRect'
  >;

export type SingTimelineFrame = {
  width: number;
  height: number;
  notes: readonly TrackNote[];
  range: LaneRange;
  now: number;
  colors: SingTimelineColors;
  voice: VoiceSource;
  /** The lanes the last frame drew, so a window of lanes stays put. */
  previousRange?: LaneRange;
};

const NOTE_RADIUS = 3;
const NOTE_FONT_SIZE = 10;
const VOICE_WIDTH = 2;

/** Every lane names its note on the left, in place of listen mode's keyboard. */
function drawLaneLabels(ctx: SingTimelineContext, frame: SingTimelineFrame) {
  const { height, range, colors } = frame;
  const lane = laneHeight(range, height);
  ctx.fillStyle = colors.key;
  ctx.fillRect(0, 0, KEYBOARD_WIDTH, height);
  ctx.fillStyle = colors.keyLabel;
  ctx.font = `500 ${NOTE_FONT_SIZE}px ${colors.fontFamily}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  // Every lane is at least MIN_SING_LANE_PX tall (see singLaneRange).
  for (let midi = range.low; midi <= range.high; midi += 1) {
    const top = laneTop(midi, range, height);
    ctx.fillText(noteName(midi), KEYBOARD_WIDTH - 5, top + lane / 2);
  }
  ctx.fillStyle = colors.border;
  ctx.fillRect(KEYBOARD_WIDTH - 1, 0, 1, height);
}

function drawNote(
  ctx: SingTimelineContext,
  note: TrackNote,
  box: NoteBox,
  frame: SingTimelineFrame,
): void {
  const { colors, now } = frame;
  const current = noteStateAt(note, now) === 'current';
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, NOTE_RADIUS);
  const judgment = frame.voice.judgment?.(note);
  ctx.fillStyle = judgment
    ? (colors[judgment] ?? colors.current)
    : current
      ? colors.current
      : colors.muted;
  ctx.fill();
  if (!current && !judgment) {
    ctx.strokeStyle = colors.mutedLine;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawTargets(ctx: SingTimelineContext, frame: SingTimelineFrame) {
  for (const { note, box } of visibleNoteBoxes(frame)) {
    drawNote(ctx, note, box, frame);
  }
  drawNoteLabels(ctx, frame, (note, inside) => {
    const judgment = frame.voice.judgment?.(note);
    if (judgment)
      return inside
        ? frame.colors.noteLabel
        : (frame.colors[judgment] ?? frame.colors.current);
    if (noteStateAt(note, frame.now) !== 'current')
      return frame.colors.mutedLabel;
    return inside ? frame.colors.noteLabel : frame.colors.current;
  });
}

/** The user's voice: a 2px line, round caps, a gap wherever nothing is sung. */
function drawVoice(ctx: SingTimelineContext, frame: SingTimelineFrame) {
  const { width, height, range, now, colors, voice } = frame;
  const playheadX = playheadXOf(width, KEYBOARD_WIDTH);
  const lane = laneHeight(range, height);
  const from = xToTime(KEYBOARD_WIDTH, now, playheadX);
  const to = xToTime(width, now, playheadX);
  ctx.strokeStyle = colors.voice;
  ctx.lineWidth = VOICE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const segment of voice.segments(from, to)) {
    ctx.beginPath();
    segment.forEach((point, index) => {
      const x = timeToX(point.time, now, playheadX);
      // A lane's middle is where its own note sits; between two lanes is
      // between two semitones.
      // Keep the 2px stroke crisp against judgment fills. The captured pitch
      // stays fractional; only its final screen coordinate is pixel-aligned.
      const y = Math.round((range.high - point.midi + 0.5) * lane);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      // A lone reading has no length: a round-capped hair of a line is a dot.
      if (segment.length === 1) ctx.lineTo(x + 0.01, y);
    });
    ctx.stroke();
  }
}

/**
 * Draws the roll in sing mode (DESIGN.md "Sing mode"): every lane labeled with
 * its note, upcoming and past notes muted, the current note in the primary
 * color, and the user's voice on top. Like the listen mode it draws from
 * scratch on every call. It returns the lanes it drew, to hand back as
 * `previousRange` in the next frame.
 */
export function drawSingTimeline(
  ctx: SingTimelineContext,
  fullFrame: SingTimelineFrame,
): LaneRange {
  const frame = {
    ...fullFrame,
    range: singLaneRange(
      fullFrame.range,
      fullFrame.height,
      singFocusKey(fullFrame.notes, fullFrame.now),
      fullFrame.previousRange,
    ),
  };
  ctx.save();
  drawLanes(ctx, frame);
  drawBeatLines(ctx, frame);
  drawInRoll(ctx, frame, () => {
    drawTargets(ctx, frame);
    drawVoice(ctx, frame);
  });
  drawLaneLabels(ctx, frame);
  drawPlayhead(ctx, frame);
  ctx.restore();
  return frame.range;
}
