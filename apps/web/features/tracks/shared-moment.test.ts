import { describe, expect, it } from 'vitest';

import { canSeekToSharedMoment, sharedMomentOf } from './shared-moment';

describe('sharedMomentOf', () => {
  it('keeps a moment from the start of the Track on, fractions included', () => {
    expect(sharedMomentOf(0)).toBe(0);
    expect(sharedMomentOf(83)).toBe(83);
    expect(sharedMomentOf(12.5)).toBe(12.5);
  });

  it('ignores a link without a moment or with a negative or broken one', () => {
    expect(sharedMomentOf(null)).toBeNull();
    expect(sharedMomentOf(-1)).toBeNull();
    expect(sharedMomentOf(Number.NaN)).toBeNull();
    expect(sharedMomentOf(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('canSeekToSharedMoment', () => {
  it('waits for the player to load and gives up when it failed', () => {
    expect(canSeekToSharedMoment('loading')).toBe(false);
    expect(canSeekToSharedMoment('error')).toBe(false);
  });

  it.each(['ready', 'playing', 'paused', 'ended'])(
    'seeks once %s',
    (status) => {
      expect(canSeekToSharedMoment(status)).toBe(true);
    },
  );
});
