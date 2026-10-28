import { accuracyBand } from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';

// The bands live in @vozzify/contracts, which has no test runner of its own,
// so their boundaries are pinned here.
describe('accuracyBand', () => {
  it.each([
    [1, 'hit'],
    [0.85, 'hit'],
    [0.8499, 'near'],
    [0.6, 'near'],
    [0.5999, 'miss'],
    [0, 'miss'],
  ] as const)('reads %s as %s', (accuracy, band) => {
    expect(accuracyBand(accuracy)).toBe(band);
  });
});
