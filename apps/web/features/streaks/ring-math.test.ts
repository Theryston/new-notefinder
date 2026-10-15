import { describe, expect, it } from 'vitest';

import { remainingParts, ringProgress } from './ring-math';

describe('ringProgress', () => {
  it('is the share of the target reached', () => {
    expect(ringProgress(0, 300)).toBe(0);
    expect(ringProgress(75, 300)).toBe(0.25);
    expect(ringProgress(300, 300)).toBe(1);
  });

  it('stays between empty and full', () => {
    expect(ringProgress(900, 300)).toBe(1);
    expect(ringProgress(-5, 300)).toBe(0);
  });

  it('is empty without a target', () => {
    expect(ringProgress(10, 0)).toBe(0);
  });
});

describe('remainingParts', () => {
  it('splits what is left of the target', () => {
    expect(remainingParts(30, 300)).toEqual({ minutes: 4, seconds: 30 });
    expect(remainingParts(0, 900)).toEqual({ minutes: 15, seconds: 0 });
  });

  it('is zero once the target is reached', () => {
    expect(remainingParts(300, 300)).toEqual({ minutes: 0, seconds: 0 });
    expect(remainingParts(500, 300)).toEqual({ minutes: 0, seconds: 0 });
  });
});
