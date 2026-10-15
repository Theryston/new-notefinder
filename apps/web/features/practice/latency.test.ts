import { describe, expect, it } from 'vitest';

import { latencyCompensation } from './latency';

describe('latencyCompensation', () => {
  it('adds the output, the input and half the detector window', () => {
    expect(
      latencyCompensation(
        { baseLatency: 0.01, outputLatency: 0.05, inputLatency: 0.02 },
        0.04,
      ),
    ).toBeCloseTo(0.1);
  });

  it('is just half the window when the browser reports nothing', () => {
    expect(latencyCompensation({}, 0.04)).toBeCloseTo(0.02);
  });

  it('ignores values a browser reports as zero, negative or not a number', () => {
    expect(
      latencyCompensation(
        { baseLatency: 0, outputLatency: -1, inputLatency: Number.NaN },
        0.04,
      ),
    ).toBeCloseTo(0.02);
    expect(
      latencyCompensation({ outputLatency: Number.POSITIVE_INFINITY }, 0),
    ).toBe(0);
  });

  it('grows with each reported delay', () => {
    const base = latencyCompensation({ outputLatency: 0.05 }, 0.04);
    expect(latencyCompensation({ outputLatency: 0.15 }, 0.04)).toBeCloseTo(
      base + 0.1,
    );
  });
});
