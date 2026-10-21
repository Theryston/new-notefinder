import { describe, expect, it } from 'vitest';

import {
  isSharpKey,
  keyOf,
  noteName,
  RANGE_BAR_HIGHEST,
  RANGE_BAR_LOWEST,
  rangeBarGeometry,
  rangeName,
} from './music-notes';

describe('MIDI keys', () => {
  it('takes the key nearest to a pitch', () => {
    expect(keyOf({ pitch: 69 })).toBe(69);
    expect(keyOf({ pitch: 60.4 })).toBe(60);
    expect(keyOf({ pitch: 60.6 })).toBe(61);
    expect(keyOf({ pitch: 61.5 })).toBe(62);
    expect(keyOf({ pitch: -0.4 })).toBe(0);
  });

  it('names a MIDI number back, sharps with #', () => {
    expect(noteName(69)).toBe('A4');
    expect(noteName(61)).toBe('C#4');
    expect(noteName(0)).toBe('C-1');
    expect(noteName(47)).toBe('B2');
  });

  it('names a pitch after its nearest key, across octave boundaries', () => {
    expect(noteName(71.4)).toBe('B4');
    expect(noteName(71.5)).toBe('C5');
    expect(noteName(59.6)).toBe('C4');
    expect(noteName(-0.6)).toBe('B-2');
    expect(noteName(-13)).toBe('B-3');
  });

  it('tells the black keys', () => {
    expect([60, 61, 62, 63, 64].map(isSharpKey)).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
  });
});

describe('rangeName', () => {
  it('names a range after its lowest and highest keys', () => {
    expect(rangeName(50, 69)).toBe('D3–A4');
  });

  it('names sharps with #', () => {
    expect(rangeName(61, 66)).toBe('C#4–F#4');
  });

  it('names a single key twice', () => {
    expect(rangeName(60, 60)).toBe('C4–C4');
  });
});

describe('rangeBarGeometry', () => {
  it('spans the whole bar for the full compass', () => {
    expect(rangeBarGeometry(RANGE_BAR_LOWEST, RANGE_BAR_HIGHEST)).toEqual({
      leftPercent: 0,
      widthPercent: 100,
    });
  });

  it('places a range by its start and span', () => {
    const { leftPercent, widthPercent } = rangeBarGeometry(60, 72);

    expect(leftPercent).toBeCloseTo(44.83, 2);
    expect(widthPercent).toBeCloseTo(13.79, 2);
  });

  it('clamps a range that hangs over the compass', () => {
    expect(rangeBarGeometry(0, 200)).toEqual({
      leftPercent: 0,
      widthPercent: 100,
    });
  });

  it('draws nothing wide for a single key', () => {
    const { leftPercent, widthPercent } = rangeBarGeometry(60, 60);

    expect(leftPercent).toBeCloseTo(44.83, 2);
    expect(widthPercent).toBe(0);
  });
});
