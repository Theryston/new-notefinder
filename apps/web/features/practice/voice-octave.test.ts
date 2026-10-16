import { describe, expect, it } from 'vitest';
import { foldReference, foldVoiceOctave } from './voice-octave';

const notes = [
  { pitch: 69, start: 0, end: 2 },
  { pitch: 72, start: 2, end: 4 },
];

describe('voice octave folding', () => {
  it('shifts a comfortable lower or higher octave onto the target note', () => {
    expect(foldVoiceOctave(57, 69)).toBe(69);
    expect(foldVoiceOctave(81, 69)).toBe(69);
    expect(foldVoiceOctave(69.4, 69)).toBeCloseTo(69.4);
  });
  it('keeps a pitch already closer to the reference where it is', () => {
    expect(foldVoiceOctave(67, 69)).toBe(67);
  });
  it('folds onto the note under the moment, else the nearest note', () => {
    expect(foldReference(notes, 1)).toBe(69);
    expect(foldReference(notes, 3)).toBe(72);
    expect(foldReference(notes, 2.4)).toBe(72);
    expect(foldReference(notes, -5)).toBe(69);
    expect(foldReference([], 1)).toBeNull();
  });
});
