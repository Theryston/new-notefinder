import { describe, expect, it } from 'vitest';

import { describeRange } from './vocal-range';

describe('describeRange', () => {
  it('names the ends and counts whole octaves', () => {
    expect(describeRange({ lowest: 62, highest: 74 })).toEqual({
      low: 'D4',
      high: 'D5',
      octaves: 1,
    });
  });

  it('counts a part of an octave to one decimal', () => {
    expect(describeRange({ lowest: 62, highest: 81 }).octaves).toBe(1.6);
  });

  it('is no octaves for a single note', () => {
    expect(describeRange({ lowest: 60, highest: 60 })).toEqual({
      low: 'C4',
      high: 'C4',
      octaves: 0,
    });
  });
});
