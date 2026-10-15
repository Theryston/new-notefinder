import { describe, expect, it } from 'vitest';

import { noteOn as sung } from '@/lib/note-fixtures';

import { detectedName, targetNameAt } from './readout';

const notes = [sung('C', 4, 0, 1), sung('D', 4, 2, 4), sung('E', 4, 5, 6)];

describe('targetNameAt', () => {
  it('names the note under the playhead', () => {
    expect(targetNameAt(notes, 0)).toBe('C4');
    expect(targetNameAt(notes, 3)).toBe('D4');
    expect(targetNameAt(notes, 5.5)).toBe('E4');
  });

  it('is empty in a rest', () => {
    expect(targetNameAt(notes, 1.5)).toBeNull();
    expect(targetNameAt(notes, 4)).toBeNull();
  });

  it('is empty before the first and after the last note', () => {
    expect(targetNameAt(notes, -1)).toBeNull();
    expect(targetNameAt(notes, 7)).toBeNull();
  });

  it('is empty for a Track with no notes', () => {
    expect(targetNameAt([], 1)).toBeNull();
  });

  it('finds the note in a long Track', () => {
    const many = Array.from({ length: 1000 }, (_, index) =>
      sung('A', 3, index * 2, index * 2 + 1),
    );
    expect(targetNameAt(many, 1500.5)).toBe('A3');
    expect(targetNameAt(many, 1501.5)).toBeNull();
  });
});

describe('detectedName', () => {
  it('names the nearest key', () => {
    expect(detectedName(69)).toBe('A4');
    expect(detectedName(69.4)).toBe('A4');
    expect(detectedName(69.6)).toBe('A#4');
  });

  it('is empty when nothing is sung', () => {
    expect(detectedName(null)).toBeNull();
  });
});
