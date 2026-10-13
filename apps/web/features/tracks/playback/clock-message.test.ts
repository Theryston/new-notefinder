import { describe, expect, it, vi } from 'vitest';

import { clockMessage, formatClock } from './clock-message';

describe('clockMessage', () => {
  it('writes a short moment as minutes and seconds', () => {
    expect(clockMessage(188)).toEqual({
      key: 'durationShort',
      values: { hours: 0, minutes: 3, seconds: 8 },
    });
  });

  it('adds hours from an hour on', () => {
    expect(clockMessage(3725)).toEqual({
      key: 'durationLong',
      values: { hours: 1, minutes: 2, seconds: 5 },
    });
  });

  it('formats a clock through the translator it is given', () => {
    const translate = vi.fn(
      (key: string, values: { minutes: number }) => `${key}:${values.minutes}`,
    );

    expect(formatClock(188, translate)).toBe('durationShort:3');
    expect(formatClock(3725, translate)).toBe('durationLong:2');
  });

  it('rounds to the nearest second', () => {
    expect(clockMessage(59.6).values).toEqual({
      hours: 0,
      minutes: 1,
      seconds: 0,
    });
  });
});
