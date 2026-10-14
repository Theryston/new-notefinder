import { describe, expect, it } from 'vitest';

import { isSharpKey, keyOf, noteName } from './music-notes';

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
