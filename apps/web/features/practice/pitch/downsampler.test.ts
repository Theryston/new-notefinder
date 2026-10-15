import { describe, expect, it } from 'vitest';

import { Downsampler } from './downsampler';
import { syntheticTone } from './synthetic-tone';

describe('Downsampler', () => {
  it('gives one sample for every three at 48 kHz to 16 kHz', () => {
    const out = new Downsampler(48_000, 16_000).push(new Float32Array(300));
    expect(out).toHaveLength(100);
  });

  it('averages the samples it covers', () => {
    const out = new Downsampler(4, 2).push(Float32Array.from([1, 3, 5, 7]));
    expect([...out]).toEqual([2, 6]);
  });

  it('gives the same samples whatever the block size', () => {
    const tone = syntheticTone({
      frequency: 300,
      sampleRate: 44_100,
      length: 4410,
    });
    const whole = new Downsampler(44_100, 16_000).push(tone);
    const pieces = new Downsampler(44_100, 16_000);
    const joined: number[] = [];
    for (let at = 0; at < tone.length; at += 128) {
      joined.push(...pieces.push(tone.subarray(at, at + 128)));
    }
    expect(joined).toHaveLength(whole.length);
    expect(joined[10]).toBeCloseTo(whole[10] ?? Number.NaN, 5);
  });

  it('keeps a voice tone at its pitch', () => {
    const tone = syntheticTone({
      frequency: 220,
      sampleRate: 48_000,
      length: 4800,
    });
    const out = new Downsampler(48_000, 16_000).push(tone);
    // 220 Hz at 16 kHz still crosses zero upwards about 22 times in 0.1 s.
    let crossings = 0;
    for (let i = 1; i < out.length; i += 1) {
      if ((out[i - 1] ?? 0) < 0 && (out[i] ?? 0) >= 0) crossings += 1;
    }
    expect(crossings).toBeGreaterThanOrEqual(21);
    expect(crossings).toBeLessThanOrEqual(23);
  });
});
