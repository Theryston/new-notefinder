import { describe, expect, it } from 'vitest';

import { compensatedPitch, waveformPeaks } from './waveform';

describe('direct audio waveform', () => {
  it('uses all samples including the last partial bin and normalizes absolute peaks', () => {
    expect(waveformPeaks(new Float32Array([0, -0.5, 0.25, 0, 1]), 2)).toEqual([
      0.5, 1,
    ]);
  });
  it('keeps silence flat and does not invent samples', () => {
    expect(waveformPeaks(new Float32Array([0, 0]), 4)).toEqual([0, 0]);
    expect(waveformPeaks(new Float32Array())).toEqual([]);
    expect(waveformPeaks(new Float32Array([1]), 0)).toEqual([]);
  });
  it.each([0.5, 0.75, 1, 1.25, 1.5])(
    'cancels media pitch changes at rate %s',
    (rate) => {
      expect(compensatedPitch(3, rate) + 12 * Math.log2(rate)).toBeCloseTo(3);
    },
  );
});
