import { describe, expect, it } from 'vitest';
import { calibrationOffset, shiftedVoiceTime } from './calibration-math';

describe('device calibration timing', () => {
  it('adds only the residual delay to automatic compensation', () => {
    expect(calibrationOffset([0.14, 0.15, 0.16, 0.15])).toBeCloseTo(0.15);
    expect(shiftedVoiceTime(8.8, 0.15, 1)).toBeCloseTo(8.65);
    expect(shiftedVoiceTime(8.8, 0.15, 0.5)).toBeCloseTo(8.725);
    expect(shiftedVoiceTime(8.8, -0.1, 1.5)).toBeCloseTo(8.95);
  });
  it('rejects too few, inconsistent or invalid sung responses', () => {
    expect(calibrationOffset([0.1, 0.1])).toBeNull();
    expect(calibrationOffset([0.1, 0.4, 0.7, 0.9])).toBeNull();
    expect(calibrationOffset([Number.NaN, 0.1, 0.1])).toBeNull();
    expect(calibrationOffset([3, 3, 3])).toBeNull();
  });
});
