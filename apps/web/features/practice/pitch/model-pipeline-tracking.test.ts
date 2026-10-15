import { describe, expect, it, vi } from 'vitest';

import { ModelPipeline } from './model-pipeline';
import { activationFor } from './synthetic-activation';
import { syntheticTone } from './synthetic-tone';

describe('ModelPipeline voice continuity', () => {
  it.each(['diffuse', 'harmonic'])(
    'recovers a steady voice from a %s model prediction',
    async (kind) => {
      const activation = activationFor(440).map((value, index) =>
        Math.max(
          value * 0.4,
          kind === 'harmonic' ? (activationFor(880)[index] ?? 0) : 0,
        ),
      );
      const readings: (number | null)[] = [];
      const onGiveUp = vi.fn();
      const pipeline = new ModelPipeline(
        48_000,
        { detect: () => Promise.resolve(activation) },
        { onReading: (midi) => readings.push(midi), onGiveUp },
      );

      for (let start = 0; start < 24_000; start += 128) {
        pipeline.feed(
          syntheticTone({
            frequency: 440,
            sampleRate: 48_000,
            length: 128,
            start,
          }),
        );
        await Promise.resolve();
      }

      expect(onGiveUp).not.toHaveBeenCalled();
      expect(readings.length).toBeGreaterThan(10);
      for (const midi of readings.slice(2)) expect(midi).toBeCloseTo(69, 0);

      for (let index = 0; index < 100; index += 1) {
        pipeline.feed(new Float32Array(128));
        await Promise.resolve();
      }
      expect(readings.slice(-3)).toEqual([null, null, null]);
      pipeline.stop();
    },
  );
});
