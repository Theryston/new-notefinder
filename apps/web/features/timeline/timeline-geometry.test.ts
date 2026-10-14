import { PITCH_CLASS_NAMES, type TrackNote } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import {
  fitsLabel,
  laneCount,
  laneHeight,
  laneRangeOf,
  laneTop,
  midiAtY,
  noteStateAt,
  PIXELS_PER_SECOND,
  PLAYHEAD_RATIO,
  playheadXOf,
  timeToX,
  xToTime,
} from './timeline-geometry';

const note = (
  name: (typeof PITCH_CLASS_NAMES)[number],
  octave: number,
): TrackNote => ({
  pitch: (octave + 1) * 12 + PITCH_CLASS_NAMES.indexOf(name),
  start: 0,
  end: 1,
});

describe('laneRangeOf', () => {
  it('fits the Track range with a lane of room on each side', () => {
    const range = laneRangeOf([note('C', 3), note('C', 5)]);
    expect(range).toEqual({ low: 47, high: 73 });
  });

  it('never shows fewer lanes than the minimum, centered on the range', () => {
    const range = laneRangeOf([note('A', 4)]);
    expect(laneCount(range)).toBe(13);
    expect(range.low).toBeLessThanOrEqual(68);
    expect(range.high).toBeGreaterThanOrEqual(70);
  });

  it('rests on C4 to C5 without notes', () => {
    expect(laneRangeOf([])).toEqual({ low: 59, high: 73 });
  });

  it('stays inside the MIDI range', () => {
    expect(laneRangeOf([note('C', -1)]).low).toBe(0);
    expect(laneRangeOf([note('G', 9)]).high).toBeLessThanOrEqual(127);
  });
});

describe('lanes', () => {
  const range = { low: 60, high: 71 };

  it('puts higher notes higher up, one lane each', () => {
    expect(laneHeight(range, 120)).toBe(10);
    expect(laneTop(71, range, 120)).toBe(0);
    expect(laneTop(60, range, 120)).toBe(110);
  });

  it('finds the note under a y, and none outside', () => {
    expect(midiAtY(0, range, 120)).toBe(71);
    expect(midiAtY(119, range, 120)).toBe(60);
    expect(midiAtY(-1, range, 120)).toBeNull();
    expect(midiAtY(120, range, 120)).toBeNull();
  });
});

describe('time and x', () => {
  const playhead = playheadXOf(1000, 40);

  it('puts the playhead at 40% of the roll after the keyboard', () => {
    expect(playhead).toBe(40 + 960 * PLAYHEAD_RATIO);
  });

  it('draws the current moment on the playhead and the future to its right', () => {
    expect(timeToX(12, 12, playhead)).toBe(playhead);
    expect(timeToX(13, 12, playhead)).toBe(playhead + PIXELS_PER_SECOND);
    expect(timeToX(11, 12, playhead)).toBe(playhead - PIXELS_PER_SECOND);
  });

  it('maps an x back to the same moment', () => {
    const x = timeToX(37.25, 12, playhead);
    expect(xToTime(x, 12, playhead)).toBeCloseTo(37.25, 10);
  });
});

describe('noteStateAt', () => {
  const sung = { start: 2, end: 4 };

  it('is upcoming before the note starts', () => {
    expect(noteStateAt(sung, 1.99)).toBe('upcoming');
  });

  it('is current from its start until its end', () => {
    expect(noteStateAt(sung, 2)).toBe('current');
    expect(noteStateAt(sung, 3.99)).toBe('current');
  });

  it('is past once it ends', () => {
    expect(noteStateAt(sung, 4)).toBe('past');
  });
});

describe('fitsLabel', () => {
  it('needs a wide enough bar and a tall enough lane', () => {
    expect(fitsLabel(40, 12)).toBe(true);
    expect(fitsLabel(20, 12)).toBe(false);
    expect(fitsLabel(40, 6)).toBe(false);
  });
});
