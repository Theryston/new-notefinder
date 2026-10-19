import { describe, expect, it } from 'vitest';

import { shownSummaryStats } from './profile-summary-stats';

const everything = {
  streakDays: 4,
  sungCount: 1250,
  favoritesCount: 7,
  contributionsCount: 1,
};

describe('shownSummaryStats', () => {
  it('shows every stat the API sent a number for', () => {
    expect(shownSummaryStats(everything)).toEqual([
      'streak',
      'sung',
      'favorites',
      'contributions',
    ]);
  });

  it('leaves out a counter the API withheld, because its section is hidden', () => {
    expect(shownSummaryStats({ ...everything, favoritesCount: null })).toEqual([
      'streak',
      'sung',
      'contributions',
    ]);
    expect(shownSummaryStats({ ...everything, sungCount: null })).toEqual([
      'streak',
      'favorites',
      'contributions',
    ]);
  });
});
