import { describe, expect, it } from 'vitest';

import { trendingScore } from './trending-score.js';

describe('trendingScore', () => {
  it('scores a Track with no views as zero', () => {
    expect(
      trendingScore({
        thisHourCount: 0,
        todayCount: 0,
        thisWeekCount: 0,
        thisMonthCount: 0,
        allTimeCount: 0,
        globalHourAverage: 0,
        globalDayAverage: 0,
      }),
    ).toBe(0);
  });

  it('applies the legacy period weights, trend boost and log scale', () => {
    expect(
      trendingScore({
        thisHourCount: 1,
        todayCount: 1,
        thisWeekCount: 1,
        thisMonthCount: 1,
        allTimeCount: 1,
        globalHourAverage: 0,
        globalDayAverage: 0,
      }),
    ).toBe(4);
  });

  it('caps the legacy trend boost at five times the base score', () => {
    expect(
      trendingScore({
        thisHourCount: 100,
        todayCount: 100,
        thisWeekCount: 100,
        thisMonthCount: 100,
        allTimeCount: 100,
        globalHourAverage: 0,
        globalDayAverage: 0,
      }),
    ).toBe(4_810);
  });
});
