import { describe, expect, it } from 'vitest';

import { noteOn as sung } from '@/lib/note-fixtures';

import { KEYBOARD_WIDTH } from './draw-listen-timeline';
import {
  drawSingTimeline,
  type SingTimelineColors,
  type SingTimelineContext,
  type VoicePoint,
} from './draw-sing-timeline';
import { laneRangeOf, playheadXOf } from './timeline-geometry';

const colors: SingTimelineColors = {
  lane: 'lane',
  surface: 'surface',
  border: 'border',
  key: 'key',
  keySharp: 'key-sharp',
  keyLabel: 'key-label',
  note: 'note',
  notePast: 'note-past',
  noteLabel: 'note-label',
  playhead: 'playhead',
  fontFamily: 'mono',
  muted: 'muted',
  mutedLine: 'muted-line',
  mutedLabel: 'muted-label',
  current: 'current',
  voice: 'voice',
};

type Path = { style: string; width: number; points: number[][] };

/** A context that remembers what was drawn, not how a browser paints it. */
function recordingContext() {
  const bars: { x: number; fill: string }[] = [];
  const labels: string[] = [];
  const paths: Path[] = [];
  let pendingBar: number[] = [];
  let points: number[][] = [];
  const ctx = {
    fillStyle: '' as string,
    strokeStyle: '' as string,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: () => undefined,
    restore: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    fillRect: () => undefined,
    beginPath: () => {
      points = [];
    },
    roundRect: (...args: number[]) => {
      pendingBar = args;
    },
    fill() {
      bars.push({
        x: pendingBar[0] ?? Number.NaN,
        fill: String(this.fillStyle),
      });
    },
    moveTo: (x: number, y: number) => points.push([x, y]),
    lineTo: (x: number, y: number) => points.push([x, y]),
    stroke() {
      paths.push({
        style: String(this.strokeStyle),
        width: this.lineWidth,
        points,
      });
    },
    fillText(text: string) {
      labels.push(`${this.font.split(' ')[0]}:${text}`);
    },
  };
  return {
    ctx: ctx as unknown as SingTimelineContext,
    bars,
    labels,
    paths,
    caps: () => ctx.lineCap,
  };
}

const notes = [sung('C', 4, 0, 1), sung('D', 4, 2, 4), sung('E', 4, 5, 6)];

function voiceOf(segments: VoicePoint[][]) {
  return { segments: () => segments, subscribe: () => () => {} };
}

const frame = (now: number, segments: VoicePoint[][] = []) => ({
  width: 800,
  height: 260,
  notes,
  range: laneRangeOf(notes),
  now,
  colors,
  voice: voiceOf(segments),
});

describe('drawSingTimeline', () => {
  it('labels every lane with its note on the left', () => {
    const { ctx, labels } = recordingContext();
    const f = frame(0);
    drawSingTimeline(ctx, f);
    const lanes = f.range.high - f.range.low + 1;
    const laneLabels = labels.filter((label) => label.startsWith('500'));
    expect(laneLabels).toHaveLength(lanes);
    expect(laneLabels).toContain('500:C4');
    expect(laneLabels).toContain('500:C#4');
  });

  it('mutes the notes to come and colors the current one', () => {
    const { ctx, bars } = recordingContext();
    drawSingTimeline(ctx, frame(3));
    const x = (note: { start: number }) =>
      playheadXOf(800, KEYBOARD_WIDTH) + (note.start - 3) * 96;
    const fillOf = (note: { start: number }) =>
      bars.find((bar) => Math.abs(bar.x - x(note)) < 0.5)?.fill;
    expect(fillOf(notes[0] as { start: number })).toBe('muted');
    expect(fillOf(notes[1] as { start: number })).toBe('current');
    expect(fillOf(notes[2] as { start: number })).toBe('muted');
  });

  it('writes the note name inside a bar that is wide enough', () => {
    const { ctx, labels } = recordingContext();
    drawSingTimeline(ctx, frame(3));
    expect(labels).toContain('600:D4');
  });

  it('draws the voice as one 2px line per stretch, with a gap between', () => {
    const { ctx, paths } = recordingContext();
    drawSingTimeline(
      ctx,
      frame(3, [
        [
          { time: 2.5, midi: 62 },
          { time: 2.6, midi: 62 },
        ],
        [
          { time: 3.2, midi: 64 },
          { time: 3.3, midi: 64 },
        ],
      ]),
    );
    const voice = paths.filter((path) => path.style === 'voice');
    expect(voice).toHaveLength(2);
    expect(voice[0]?.width).toBe(2);
    expect(voice[0]?.points).toHaveLength(2);
  });

  it('puts the voice on the lane of the note it sings', () => {
    const { ctx, paths } = recordingContext();
    const f = frame(3, [[{ time: 3, midi: 62 }]]);
    drawSingTimeline(ctx, f);
    const point = paths.find((path) => path.style === 'voice')?.points[0];
    const lane = 260 / (f.range.high - f.range.low + 1);
    expect(point?.[0]).toBeCloseTo(playheadXOf(800, KEYBOARD_WIDTH));
    expect(point?.[1]).toBeCloseTo((f.range.high - 62 + 0.5) * lane);
  });

  it('draws a lone reading as a dot, not nothing', () => {
    const { ctx, paths } = recordingContext();
    drawSingTimeline(ctx, frame(3, [[{ time: 3, midi: 62 }]]));
    expect(paths.find((path) => path.style === 'voice')?.points).toHaveLength(
      2,
    );
  });

  it('draws no voice line while nothing is sung', () => {
    const { ctx, paths } = recordingContext();
    drawSingTimeline(ctx, frame(3));
    expect(paths.filter((path) => path.style === 'voice')).toEqual([]);
  });

  it('rounds the voice line’s ends', () => {
    const rec = recordingContext();
    drawSingTimeline(rec.ctx, frame(3, [[{ time: 3, midi: 62 }]]));
    expect(rec.caps()).toBe('round');
  });

  it('skips the lane labels when lanes are too thin to read', () => {
    const { ctx, labels } = recordingContext();
    drawSingTimeline(ctx, { ...frame(0), height: 60 });
    expect(labels.filter((label) => label.startsWith('500'))).toEqual([]);
  });
});
