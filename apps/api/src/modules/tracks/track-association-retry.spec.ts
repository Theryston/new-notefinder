import { trackAssociationRetryDelay } from './track-association-retry.js';

describe('trackAssociationRetryDelay', () => {
  it('increases retry delays exponentially', () => {
    expect([1, 2, 3, 4].map(trackAssociationRetryDelay)).toEqual([
      5_000, 10_000, 20_000, 40_000,
    ]);
  });

  it('caps delays during a long Music catalog outage', () => {
    expect(trackAssociationRetryDelay(100)).toBe(10 * 60 * 1_000);
  });
});
