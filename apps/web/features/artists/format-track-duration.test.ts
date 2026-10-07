import { describe, expect, it } from 'vitest';

import { formatTrackDuration } from './format-track-duration';

describe('formatTrackDuration', () => {
  it('formats milliseconds as minutes and seconds', () => {
    expect(formatTrackDuration(354_000)).toBe('5:54');
  });

  it('pads single-digit seconds', () => {
    expect(formatTrackDuration(65_000)).toBe('1:05');
  });

  it('formats zero and sub-minute lengths', () => {
    expect(formatTrackDuration(0)).toBe('0:00');
    expect(formatTrackDuration(59_999)).toBe('0:59');
  });

  it('floors partial seconds', () => {
    expect(formatTrackDuration(61_500)).toBe('1:01');
  });
});
