import { describe, expect, it, vi } from 'vitest';

import { noteOn } from '@/lib/note-fixtures';

import { drawListenTimeline } from './draw-listen-timeline';
import {
  drawSingTimeline,
  type SingTimelineColors,
  type SingTimelineContext,
} from './draw-sing-timeline';
import { laneRangeOf } from './timeline-geometry';

function context() {
  const text: { name: string; x: number; color: string }[] = [];
  const bars = vi.fn();
  const ctx: SingTimelineContext = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillText(name, x) {
      text.push({ name, x, color: String(this.fillStyle) });
    },
    beginPath: vi.fn(),
    roundRect: bars,
    fill: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    strokeRect: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'middle',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'round',
  };
  return { ctx, text, bars };
}

const colors: SingTimelineColors = {
  lane: 'lane',
  surface: 'surface',
  border: 'border',
  key: 'key',
  keySharp: 'key-sharp',
  keyLabel: 'outside-label',
  note: 'note',
  notePast: 'past',
  noteLabel: 'inside-label',
  playhead: 'playhead',
  fontFamily: 'monospace',
  muted: 'muted',
  mutedLine: 'muted-line',
  mutedLabel: 'muted-label',
  current: 'current',
  voice: 'voice',
};

const notes = [noteOn('F#', 4, 1, 1.08)];
const frame = {
  notes,
  range: laneRangeOf(notes),
  width: 360,
  height: 260,
  now: 1.04,
  colors,
};

describe('short note label rendering', () => {
  it.each(['listen', 'sing'])(
    'keeps a short note named in %s mode without stretching the bar',
    (mode) => {
      const { ctx, text, bars } = context();
      if (mode === 'listen') drawListenTimeline(ctx, frame);
      else {
        drawSingTimeline(ctx, {
          ...frame,
          voice: { segments: () => [], subscribe: () => () => {} },
        });
      }
      const label = text.find((entry) => entry.name === 'F#4' && entry.x > 44);
      expect(label).toBeDefined();
      expect(label?.color).toBe(
        mode === 'listen' ? 'outside-label' : 'current',
      );
      const box = bars.mock.calls[0];
      expect(box?.[2]).toBeCloseTo(0.08 * 96);
      expect(label?.x).toBeGreaterThan((box?.[0] ?? 0) + (box?.[2] ?? 0));
    },
  );
});
