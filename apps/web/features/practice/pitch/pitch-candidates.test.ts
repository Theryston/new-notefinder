import { describe, expect, it } from 'vitest';

import { pitchCandidates } from './pitch-candidates';
import { activationFor } from './synthetic-activation';

describe('pitchCandidates', () => {
  it('retains a weaker fundamental alongside a dominant harmonic', () => {
    const fundamental = activationFor(220);
    const harmonic = activationFor(440);
    const activation = fundamental.map((value, i) =>
      Math.max(value * 0.4, harmonic[i] ?? 0),
    );
    const candidates = pitchCandidates(activation);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.frequency).toBeCloseTo(440, -1);
    expect(candidates[1]?.frequency).toBeCloseTo(220, -1);
    expect(candidates[1]?.confidence).toBeCloseTo(0.36);
  });

  it('does not interpret a flat activation as a note', () => {
    expect(pitchCandidates(new Float32Array(360).fill(0.3))).toEqual([]);
    expect(pitchCandidates([])).toEqual([]);
  });

  it('keeps a two-bin plateau as one refined candidate', () => {
    const activation = new Float32Array(360);
    activation[200] = 0.6;
    activation[201] = 0.6;
    const candidates = pitchCandidates(activation);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.confidence).toBeCloseTo(0.6);
  });

  it('retains a peak at either boundary', () => {
    for (const bin of [0, 359]) {
      const activation = new Float32Array(360);
      activation[bin] = 0.9;
      expect(pitchCandidates(activation)).toHaveLength(1);
    }
  });
});
