import { describe, expect, it, vi } from 'vitest';

import { ModelPipeline } from './model-pipeline';

describe('ModelPipeline capture cadence', () => {
  it.each([44_100, 48_000])('preserves partial hops at %i Hz', (sampleRate) => {
    const onReading = vi.fn();
    const pipeline = new ModelPipeline(
      sampleRate,
      { detect: vi.fn() },
      { onReading, onGiveUp: vi.fn() },
    );

    for (let at = 0; at < sampleRate; at += 128) {
      pipeline.feed(new Float32Array(Math.min(128, sampleRate - at)));
    }

    // A second contains 31 complete 512-sample hops at the model's 16 kHz.
    expect(onReading).toHaveBeenCalledTimes(31);
    expect(onReading.mock.calls.every(([midi]) => midi === null)).toBe(true);
  });
});
