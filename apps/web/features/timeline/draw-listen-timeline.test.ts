import type { TrackNote } from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';

import { noteOn as sung } from '@/lib/note-fixtures';

import {
  drawListenTimeline,
  KEYBOARD_WIDTH,
  type TimelineColors,
  type TimelineContext,
} from './draw-listen-timeline';
import { laneRangeOf, playheadXOf } from './timeline-geometry';

const colors: TimelineColors = {
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
};

type Bar = { x: number; fill: string; alpha: number };

/** A context that remembers what the roll drew, not how a browser paints it. */
function recordingContext() {
  const bars: Bar[] = [];
  const labels: string[] = [];
  const fills: { style: string; rect: number[] }[] = [];
  let pendingBar: number[] = [];
  const ctx = {
    fillStyle: '' as string,
    globalAlpha: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    roundRect: (...args: number[]) => {
      pendingBar = args;
    },
    fill() {
      bars.push({
        x: pendingBar[0] ?? Number.NaN,
        fill: String(this.fillStyle),
        alpha: this.globalAlpha,
      });
    },
    fillRect(...rect: number[]) {
      fills.push({ style: String(this.fillStyle), rect });
    },
    fillText(text: string) {
      labels.push(`${this.font.split(' ')[0]}:${text}`);
    },
  };
  return { ctx: ctx as unknown as TimelineContext, bars, labels, fills };
}

const notes = [sung('C', 4, 0, 1), sung('D', 4, 2, 4), sung('E', 4, 5, 6)];

const frame = (now: number, list: readonly TrackNote[] = notes) => ({
  width: 800,
  height: 260,
  notes: list,
  range: laneRangeOf(list),
  now,
  colors,
});

describe('drawListenTimeline', () => {
  it('draws upcoming notes at 80%, the current one whole and past ones muted', () => {
    const { ctx, bars } = recordingContext();

    drawListenTimeline(ctx, frame(2.5));

    expect(bars).toEqual([
      { x: expect.any(Number), fill: 'note-past', alpha: 1 },
      { x: expect.any(Number), fill: 'note', alpha: 1 },
      { x: expect.any(Number), fill: 'note', alpha: 0.8 },
    ]);
  });

  it('rests a note starting at 0 on the playhead', () => {
    const { ctx, bars } = recordingContext();

    drawListenTimeline(ctx, frame(0));

    expect(bars[0]?.x).toBeCloseTo(playheadXOf(800, KEYBOARD_WIDTH), 5);
  });

  it('writes the note name inside bars wide enough, not inside past ones', () => {
    const { ctx, labels } = recordingContext();

    drawListenTimeline(ctx, frame(2.5));

    // C4 is past; D4 (2s wide) and E4 (1s wide) are not.
    expect(labels).toContain('600:D4');
    expect(labels).toContain('600:E4');
    expect(labels).not.toContain('600:C4');
  });

  it('skips notes outside the visible roll', () => {
    const { ctx, bars } = recordingContext();

    drawListenTimeline(ctx, frame(0, [...notes, sung('G', 4, 600, 601)]));

    // At 0 the roll shows about 4.7s ahead: E4 (5s) and G4 (600s) are off it.
    expect(bars).toHaveLength(2);
  });

  it('labels the C keys of the keyboard with their octave', () => {
    const { ctx, labels } = recordingContext();

    drawListenTimeline(ctx, frame(0));

    expect(labels).toContain('500:C4');
  });

  it('shades the sharp lanes and draws the playhead last', () => {
    const { ctx, fills } = recordingContext();

    drawListenTimeline(ctx, frame(0));

    expect(fills.some((fill) => fill.style === 'surface')).toBe(true);
    expect(fills.some((fill) => fill.style === 'key-sharp')).toBe(true);
    expect(fills.at(-1)?.style).toBe('playhead');
  });
});
