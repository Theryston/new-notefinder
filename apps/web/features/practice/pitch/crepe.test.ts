import { describe, expect, it } from 'vitest';

import { decodeActivation, normalizeFrame } from './crepe';
import { activationFor } from './synthetic-activation';

describe('normalizeFrame', () => {
  it('gives zero mean and unit variance', () => {
    const frame = normalizeFrame(Float32Array.from([1, 2, 3, 4, 5, 6]));
    const mean = frame.reduce((sum, v) => sum + v, 0) / frame.length;
    const variance = frame.reduce((sum, v) => sum + (v - mean) ** 2, 0) / 6;
    expect(mean).toBeCloseTo(0);
    expect(variance).toBeCloseTo(1);
  });

  it('does not divide by zero on a flat frame', () => {
    const frame = normalizeFrame(new Float32Array(8).fill(0.3));
    expect([...frame].every((v) => Number.isFinite(v) && v === 0)).toBe(true);
  });
});

describe('decodeActivation', () => {
  it.each([110, 220, 440, 880])('reads %f Hz from its bin', (frequency) => {
    const reading = decodeActivation(activationFor(frequency));
    // A bin is 20 cents wide.
    const cents = 1200 * Math.log2((reading?.frequency ?? 0) / frequency);
    expect(Math.abs(cents)).toBeLessThan(11);
    expect(reading?.confidence).toBeCloseTo(0.9);
  });

  it('refines the answer between bins with the neighbours', () => {
    const activation = new Float32Array(360);
    activation[200] = 0.6;
    activation[201] = 0.6;
    const bin = (frequency: number) =>
      (1200 * Math.log2(frequency / 10) - 1997.3794084376191) / 20;
    const reading = decodeActivation(activation);
    expect(bin(reading?.frequency ?? 0)).toBeCloseTo(200.5, 1);
  });

  it('copes with a peak at either end', () => {
    const low = new Float32Array(360);
    low[0] = 1;
    const high = new Float32Array(360);
    high[359] = 1;
    expect(decodeActivation(low)?.frequency).toBeCloseTo(31.7, 0);
    expect(decodeActivation(high)?.frequency).toBeGreaterThan(2000);
  });

  it('hears nothing in a flat or empty activation', () => {
    expect(decodeActivation(new Float32Array(360))).toBeNull();
    expect(decodeActivation([])).toBeNull();
  });
});
