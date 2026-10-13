import { describe, expect, it } from 'vitest';

import { PIXELS_PER_SECOND, scrubTime } from './timeline-geometry';

describe('scrubTime', () => {
  it('moves forward when the roll is dragged left, like a record', () => {
    expect(scrubTime(10, -PIXELS_PER_SECOND * 2)).toBeCloseTo(12, 5);
  });

  it('moves back when the roll is dragged right', () => {
    expect(scrubTime(10, PIXELS_PER_SECOND * 3)).toBeCloseTo(7, 5);
  });

  it('stays put without movement', () => {
    expect(scrubTime(10, 0)).toBe(10);
  });
});
