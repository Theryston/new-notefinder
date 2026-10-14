import { PITCH_CLASS_NAMES, type TrackNote } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import { distinctNoteNames, noteRangeOf } from './note-summary';

const note = (
  name: (typeof PITCH_CLASS_NAMES)[number],
  octave: number,
): TrackNote => ({
  pitch: (octave + 1) * 12 + PITCH_CLASS_NAMES.indexOf(name),
  start: 0,
  end: 1,
});

const sung = [note('E', 4), note('C#', 3), note('E', 4), note('B', 3)];

describe('distinctNoteNames', () => {
  it('lists each note once, lowest first', () => {
    expect(distinctNoteNames(sung)).toEqual(['C#3', 'B3', 'E4']);
  });

  it('keeps the lowest notes up to the limit', () => {
    expect(distinctNoteNames(sung, 2)).toEqual(['C#3', 'B3']);
  });

  it('is empty without notes', () => {
    expect(distinctNoteNames([])).toEqual([]);
  });
});

describe('noteRangeOf', () => {
  it('gives the lowest and the highest note', () => {
    expect(noteRangeOf(sung)).toEqual({ low: 'C#3', high: 'E4' });
  });

  it('is null without notes', () => {
    expect(noteRangeOf([])).toBeNull();
  });
});
