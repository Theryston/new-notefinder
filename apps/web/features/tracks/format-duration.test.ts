import { describe, expect, it } from 'vitest';

import { formatDuration } from './format-duration';

describe('formatDuration', () => {
  it('writes minutes and zero-padded seconds', () => {
    expect(formatDuration(188_000)).toBe('3:08');
    expect(formatDuration(59_000)).toBe('0:59');
  });

  it('rounds to the nearest second', () => {
    expect(formatDuration(59_600)).toBe('1:00');
  });

  it('adds hours past an hour', () => {
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });

  it('never goes below zero', () => {
    expect(formatDuration(-5)).toBe('0:00');
  });
});
