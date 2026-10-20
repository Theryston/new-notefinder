import {
  type LocaleTrackViews,
  MIN_LOCALE_VIEWS_FOR_TRENDING,
  rankLocaleTrending,
} from './track-locale-trending.js';
import { trendingScore } from './trending-score.js';

const views = (
  trackId: string,
  counts: Partial<Omit<LocaleTrackViews, 'trackId'>> = {},
): LocaleTrackViews => ({
  trackId,
  hour: 0,
  day: 0,
  week: 0,
  month: 0,
  allTime: 0,
  ...counts,
});

describe('MIN_LOCALE_VIEWS_FOR_TRENDING', () => {
  it('is 100 views in the month', () => {
    expect(MIN_LOCALE_VIEWS_FOR_TRENDING).toBe(100);
  });
});

describe('rankLocaleTrending', () => {
  it('answers nothing below the minimum, so the global figures apply', () => {
    const rows = [views('a', { hour: 1, month: 99, allTime: 99 })];

    expect(rankLocaleTrending(rows)).toBeUndefined();
  });

  it('answers nothing for a locale with no views this month', () => {
    expect(rankLocaleTrending([])).toBeUndefined();
  });

  it('ranks once the locale reaches the minimum exactly', () => {
    const rows = [views('a', { hour: 1, month: 100, allTime: 100 })];

    expect(rankLocaleTrending(rows)).toEqual([
      { trackId: 'a', score: expect.any(Number) },
    ]);
  });

  it('orders the Tracks by their own locale views, hottest first', () => {
    const rows = [
      views('quiet', { hour: 1, day: 1, week: 1, month: 60, allTime: 60 }),
      views('hot', { hour: 40, day: 40, week: 40, month: 60, allTime: 60 }),
    ];

    const ranking = rankLocaleTrending(rows);

    expect(ranking?.map((entry) => entry.trackId)).toEqual(['hot', 'quiet']);
  });

  it('scores against the locale averages, not the platform as a whole', () => {
    const hot = views('hot', {
      hour: 10,
      day: 10,
      week: 10,
      month: 100,
      allTime: 100,
    });
    const ranking = rankLocaleTrending([hot]);

    // The locale's only viewed Track averages 10 views an hour and a day.
    expect(ranking).toEqual([
      {
        trackId: 'hot',
        score: trendingScore(hot, { hour: 10, day: 10 }),
      },
    ]);
    expect(ranking?.[0]?.score).not.toBe(
      trendingScore(hot, { hour: 2, day: 2 }),
    );
  });

  it('leaves out Tracks scoring 0 and keeps the Track id order on ties', () => {
    const twin = { hour: 5, day: 5, week: 5, month: 50, allTime: 50 };
    const rows = [
      views('zeta', twin),
      views('alpha', twin),
      views('idle', { month: 0 }),
    ];

    const ranking = rankLocaleTrending(rows);

    expect(ranking?.map((entry) => entry.trackId)).toEqual(['alpha', 'zeta']);
  });
});
