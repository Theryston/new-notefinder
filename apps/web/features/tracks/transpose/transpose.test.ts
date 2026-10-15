import { describe, expect, it } from 'vitest';

import {
  clampTranspose,
  MAX_TRANSPOSE,
  MIN_TRANSPOSE,
  transposeKey,
  transposeNotes,
} from './transpose';

describe('clampTranspose', () => {
  it('keeps a whole number inside the limits', () => {
    expect(clampTranspose(3)).toBe(3);
    expect(clampTranspose(-5)).toBe(-5);
  });

  it('stops at an octave either way', () => {
    expect(clampTranspose(40)).toBe(MAX_TRANSPOSE);
    expect(clampTranspose(-40)).toBe(MIN_TRANSPOSE);
  });

  it('rounds to a whole semitone and ignores what is not a number', () => {
    expect(clampTranspose(2.6)).toBe(3);
    expect(clampTranspose(Number.NaN)).toBe(0);
    expect(clampTranspose(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('transposeNotes', () => {
  const notes = [
    { pitch: 60, start: 0, end: 1 },
    { pitch: 64.5, start: 1, end: 2 },
  ];

  it('moves every pitch and keeps the timing', () => {
    expect(transposeNotes(notes, 3)).toEqual([
      { pitch: 63, start: 0, end: 1 },
      { pitch: 67.5, start: 1, end: 2 },
    ]);
    expect(transposeNotes(notes, -12)[0]?.pitch).toBe(48);
  });

  it('hands back the same notes when nothing moves', () => {
    expect(transposeNotes(notes, 0)).toBe(notes);
  });
});

describe('transposeKey', () => {
  it('moves the tonic and keeps the mode', () => {
    expect(transposeKey({ tonic: 7, mode: 'MAJOR' }, 2)).toEqual({
      tonic: 9,
      mode: 'MAJOR',
    });
  });

  it('wraps around the octave in both directions', () => {
    expect(transposeKey({ tonic: 11, mode: 'MINOR' }, 1).tonic).toBe(0);
    expect(transposeKey({ tonic: 0, mode: 'MINOR' }, -1).tonic).toBe(11);
    expect(transposeKey({ tonic: 5, mode: 'MINOR' }, -12).tonic).toBe(5);
  });
});
