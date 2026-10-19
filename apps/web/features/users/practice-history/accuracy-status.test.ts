import { describe, expect, it } from 'vitest';

import { accuracyPercent, accuracyStatus } from './accuracy-status';

describe('accuracyStatus', () => {
  it.each([
    [1, 'hit'],
    [0.85, 'hit'],
    [0.84, 'near'],
    [0.6, 'near'],
    [0.59, 'miss'],
    [0, 'miss'],
  ] as const)('reads %s as %s', (accuracy, status) => {
    expect(accuracyStatus(accuracy)).toBe(status);
  });
});

describe('accuracyPercent', () => {
  it('rounds the accuracy to a whole percentage', () => {
    expect(accuracyPercent(0.8)).toBe(80);
    expect(accuracyPercent(0.8449)).toBe(84);
    expect(accuracyPercent(0.846)).toBe(85);
    expect(accuracyPercent(1)).toBe(100);
  });
});
