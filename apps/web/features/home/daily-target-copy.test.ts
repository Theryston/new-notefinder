import { describe, expect, it } from 'vitest';

import {
  dailyTargetCopy,
  minutesLeftOf,
  minutesTotalOf,
} from './daily-target-copy';

describe('dailyTargetCopy', () => {
  it('shows the minutes left of the goal', () => {
    expect(
      dailyTargetCopy({
        secondsLeft: 700,
        targetSeconds: 900,
        completedToday: false,
      }),
    ).toEqual({
      key: 'home.dailyTarget.remaining',
      params: { minutesLeft: 12, minutesTotal: 15 },
    });
  });

  it('counts a partial minute as a whole one', () => {
    expect(minutesLeftOf(61)).toBe(2);
    expect(minutesLeftOf(60)).toBe(1);
    expect(minutesLeftOf(0)).toBe(0);
  });

  it('reads a completed day as complete, even with seconds to spare', () => {
    expect(
      dailyTargetCopy({
        secondsLeft: 120,
        targetSeconds: 300,
        completedToday: true,
      }),
    ).toEqual({ key: 'home.dailyTarget.completeToday', params: {} });
  });

  it('nudges to start when nothing was sung yet', () => {
    expect(
      dailyTargetCopy({
        secondsLeft: 900,
        targetSeconds: 900,
        completedToday: false,
      }),
    ).toEqual({
      key: 'home.dailyTarget.fresh',
      params: { minutes: 15 },
    });
  });

  it('reads no seconds left as complete', () => {
    expect(
      dailyTargetCopy({
        secondsLeft: 0,
        targetSeconds: 300,
        completedToday: false,
      }),
    ).toEqual({ key: 'home.dailyTarget.completeToday', params: {} });
  });

  it('rounds the target to whole minutes', () => {
    expect(minutesTotalOf(300)).toBe(5);
    expect(minutesTotalOf(899)).toBe(15);
  });
});
