import { averageViewsPerTrack, trendingScore } from './trending-score.js';

// The examples are worked out by hand from the legacy `calculate-score.ts`
// (see trending-score.ts), not from this implementation.
describe('trendingScore', () => {
  it('is 0 for a Track nobody viewed', () => {
    expect(
      trendingScore(
        { hour: 0, day: 0, week: 0, month: 0, allTime: 0 },
        { hour: 0, day: 0 },
      ),
    ).toBe(0);
  });

  it('is the weighted recent views on the log scale, unboosted, with no recent trend', () => {
    // base = 1.5*0 + 1.2*0 + 1.1*3 + 1*3 = 6.3; scale = log10(10) = 1; boost 1.
    expect(
      trendingScore(
        { hour: 0, day: 0, week: 3, month: 3, allTime: 9 },
        { hour: 2, day: 4 },
      ),
    ).toBe(6);
  });

  it('boosts a Track that beats its own week and the platform average', () => {
    // base = 3 + 6 + 22 + 50 = 81; scale = log10(101) ~ 2.0043; the blended
    // trend is ~ 1.788, so the boost is ~ 2.788: 81 * 2.0043 * 2.788.
    expect(
      trendingScore(
        { hour: 2, day: 5, week: 20, month: 50, allTime: 100 },
        { hour: 1, day: 3 },
      ),
    ).toBe(453);
  });

  it('caps the trend boost at 5x', () => {
    // base = 45 + 96 + 99 + 200 = 440; scale = log10(1001) ~ 3.0004;
    // the uncapped trend is ~ 8.36, so the boost stays at 1 + 4.
    expect(
      trendingScore(
        { hour: 30, day: 80, week: 90, month: 200, allTime: 1000 },
        { hour: 1, day: 2 },
      ),
    ).toBe(6601);
  });

  it('ranks a Track viewed lately above one with the same total but older views', () => {
    const platform = { hour: 1, day: 2 };
    const lately = trendingScore(
      { hour: 5, day: 10, week: 12, month: 12, allTime: 12 },
      platform,
    );
    const older = trendingScore(
      { hour: 0, day: 0, week: 2, month: 12, allTime: 12 },
      platform,
    );

    expect(lately).toBeGreaterThan(older);
  });
});

describe('averageViewsPerTrack', () => {
  it('is the views per Track viewed, rounded', () => {
    expect(averageViewsPerTrack(7, 2)).toBe(4);
    expect(averageViewsPerTrack(10, 4)).toBe(3);
  });

  it('is 0 when nothing was viewed in the window', () => {
    expect(averageViewsPerTrack(0, 0)).toBe(0);
  });
});
