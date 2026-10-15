import { vocalRangeOf } from './track-vocal-range.js';

describe('vocalRangeOf', () => {
  it('is the lowest and the highest key sung', () => {
    expect(vocalRangeOf([{ pitch: 62 }, { pitch: 74 }, { pitch: 67 }])).toEqual(
      { lowest: 62, highest: 74 },
    );
  });

  it('rounds a pitch between two keys to the nearest, the higher on a tie', () => {
    expect(vocalRangeOf([{ pitch: 61.4 }, { pitch: 72.5 }])).toEqual({
      lowest: 61,
      highest: 73,
    });
  });

  it('is one key for a single note', () => {
    expect(vocalRangeOf([{ pitch: 60 }])).toEqual({ lowest: 60, highest: 60 });
  });

  it('stays inside the MIDI scale', () => {
    expect(vocalRangeOf([{ pitch: -3 }, { pitch: 140 }])).toEqual({
      lowest: 0,
      highest: 127,
    });
  });

  it('has no range without notes', () => {
    expect(vocalRangeOf([])).toBeNull();
  });
});
