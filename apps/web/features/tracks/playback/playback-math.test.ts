import { describe, expect, it } from 'vitest';

import {
  clampTime,
  fractionAtPointer,
  fractionOfTime,
  timeAtFraction,
} from './playback-math';

describe('clampTime', () => {
  it('keeps a moment inside the Track', () => {
    expect(clampTime(-3, 100)).toBe(0);
    expect(clampTime(40, 100)).toBe(40);
    expect(clampTime(140, 100)).toBe(100);
  });

  it('only bounds below while the length is unknown', () => {
    expect(clampTime(500, 0)).toBe(500);
    expect(clampTime(-1, 0)).toBe(0);
  });
});

describe('progress fractions', () => {
  it('maps a position along the track to a moment and back', () => {
    expect(timeAtFraction(0.25, 200)).toBe(50);
    expect(fractionOfTime(50, 200)).toBe(0.25);
  });

  it('keeps both inside the track', () => {
    expect(timeAtFraction(1.5, 200)).toBe(200);
    expect(timeAtFraction(-1, 200)).toBe(0);
    expect(fractionOfTime(300, 200)).toBe(1);
    expect(fractionOfTime(-5, 200)).toBe(0);
  });

  it('is at the start while the length is unknown', () => {
    expect(fractionOfTime(30, 0)).toBe(0);
  });
});

describe('fractionAtPointer', () => {
  const box = { left: 100, width: 400 };

  it('is the share of the box the pointer is at', () => {
    expect(fractionAtPointer(300, box)).toBe(0.5);
  });

  it('stops at both ends when the pointer leaves the box', () => {
    expect(fractionAtPointer(50, box)).toBe(0);
    expect(fractionAtPointer(900, box)).toBe(1);
  });

  it('is zero for a box with no width', () => {
    expect(fractionAtPointer(300, { left: 100, width: 0 })).toBe(0);
  });
});
