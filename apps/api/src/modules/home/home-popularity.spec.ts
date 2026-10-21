import {
  isCountedAttempt,
  POPULARITY_WEIGHTS,
  popularityScore,
  rankBySignalCount,
  SINGING_SIGNAL_WINDOW_DAYS,
  TOP_10_WINDOW_DAYS,
} from './home-popularity.js';

describe('isCountedAttempt', () => {
  it('counts a clean run', () => {
    expect(
      isCountedAttempt({ forwardSkip: false, bleedSuspected: false }),
    ).toBe(true);
  });

  it('ignores a run that skipped forward', () => {
    expect(isCountedAttempt({ forwardSkip: true, bleedSuspected: false })).toBe(
      false,
    );
  });

  it('ignores a run with a suspected bleed', () => {
    expect(isCountedAttempt({ forwardSkip: false, bleedSuspected: true })).toBe(
      false,
    );
  });
});

describe('rankBySignalCount', () => {
  it('orders Tracks by their valid Attempts, most first', () => {
    const ranked = rankBySignalCount([
      { trackId: 'b', count: 3 },
      { trackId: 'a', count: 25 },
      { trackId: 'c', count: 12 },
    ]);

    expect(ranked.map((entry) => entry.trackId)).toEqual(['a', 'c', 'b']);
  });

  it('ranks a Track people sang above one that was only viewed', () => {
    const ranked = rankBySignalCount([
      { trackId: 'viewed-only', count: 0 },
      { trackId: 'sung', count: 4 },
    ]);

    expect(ranked.map((entry) => entry.trackId)).toEqual([
      'sung',
      'viewed-only',
    ]);
  });

  it('breaks ties by Track id, so the order is stable', () => {
    const ranked = rankBySignalCount([
      { trackId: 'b', count: 5 },
      { trackId: 'a', count: 5 },
    ]);

    expect(ranked.map((entry) => entry.trackId)).toEqual(['a', 'b']);
  });
});

describe('popularityScore', () => {
  it('is the views score alone when nobody sang or favorited', () => {
    expect(
      popularityScore({ trendingScore: 100, attempts: 0, favorites: 0 }),
    ).toBe(100 * POPULARITY_WEIGHTS.trending);
  });

  it('lets a much-sung Track outrank a merely viewed one', () => {
    const viewed = popularityScore({
      trendingScore: 120,
      attempts: 0,
      favorites: 0,
    });
    const sung = popularityScore({
      trendingScore: 10,
      attempts: 10,
      favorites: 0,
    });

    expect(sung).toBeGreaterThan(viewed);
  });

  it('counts a favorite less than an attempt', () => {
    const byAttempts = popularityScore({
      trendingScore: 0,
      attempts: 2,
      favorites: 0,
    });
    const byFavorites = popularityScore({
      trendingScore: 0,
      attempts: 0,
      favorites: 2,
    });

    expect(byAttempts).toBeGreaterThan(byFavorites);
  });
});

describe('the singing windows', () => {
  it('keeps the Top 10 to the week and the sung rows to a recent window', () => {
    expect(TOP_10_WINDOW_DAYS).toBe(7);
    expect(SINGING_SIGNAL_WINDOW_DAYS).toBeGreaterThan(TOP_10_WINDOW_DAYS);
  });
});
