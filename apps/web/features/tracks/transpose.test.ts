import { describe, expect, it } from 'vitest';
import { transposeNotes, transposePitchClass } from './transpose';

describe('track transposition', () => {
  it('moves only the pitch while preserving note timing', () => {
    expect(transposeNotes([{ pitch: 60.25, start: 1, end: 2 }], -2)).toEqual([
      { pitch: 58.25, start: 1, end: 2 },
    ]);
  });

  it('wraps a tonic around the twelve pitch classes', () => {
    expect(transposePitchClass(11, 1)).toBe(0);
    expect(transposePitchClass(0, -1)).toBe(11);
  });
});
