import { describe, expect, it } from 'vitest';

import { clockMessage } from './clock-message';

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

  it('rounds to the nearest second', () => {
    expect(clockMessage(59.6).values).toEqual({
      hours: 0,
      minutes: 1,
      seconds: 0,
    });
  });
});
