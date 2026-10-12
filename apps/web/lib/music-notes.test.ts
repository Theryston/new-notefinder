import { describe, expect, it } from 'vitest';

import { isSharpKey, midiOf, noteName } from './music-notes';

describe('MIDI numbers', () => {
  it('numbers notes as MIDI does', () => {
    expect(midiOf({ note: 'A', octave: 4 })).toBe(69);
    expect(midiOf({ note: 'C', octave: 4 })).toBe(60);
    expect(midiOf({ note: 'C', octave: -1 })).toBe(0);
    expect(midiOf({ note: 'B', octave: 2 })).toBe(47);
  });

  it('names a MIDI number back, sharps with #', () => {
    expect(noteName(69)).toBe('A4');
    expect(noteName(61)).toBe('C#4');
    expect(noteName(0)).toBe('C-1');
    expect(noteName(47)).toBe('B2');
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
