import { noteSummaryOf } from './track-note-summary.js';

describe('noteSummaryOf', () => {
  it('is the range and the key as the columns hold them', () => {
    const notes = [67, 69, 71, 72, 74, 76, 78, 67, 67, 74].map(
      (pitch, index) => ({ pitch, start: index, end: index + 1 }),
    );

    expect(noteSummaryOf(notes)).toEqual({
      vocalRangeLowest: 67,
      vocalRangeHighest: 78,
      keyTonic: 7,
      keyMode: 'MAJOR',
    });
  });

  it('clears every column without notes', () => {
    expect(noteSummaryOf([])).toEqual({
      vocalRangeLowest: null,
      vocalRangeHighest: null,
      keyTonic: null,
      keyMode: null,
    });
  });
});
