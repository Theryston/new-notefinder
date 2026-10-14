import { describe, expect, it } from 'vitest';

import { syntheticTone } from './synthetic-tone';
import { detectPitchYin } from './yin';

const SAMPLE_RATE = 48_000;
const LENGTH = 2048;

const detect = (frequency: number, harmonics: readonly number[] = []) =>
  detectPitchYin(
    syntheticTone({
      frequency,
      sampleRate: SAMPLE_RATE,
      length: LENGTH,
      harmonics,
    }),
    SAMPLE_RATE,
  );

describe('detectPitchYin', () => {
  it.each([82.41, 110, 196, 261.63, 440, 659.25, 880])(
    'finds the %f Hz of a pure tone',
    (frequency) => {
      const reading = detect(frequency);
      expect(reading?.frequency).toBeCloseTo(frequency, 0);
      expect(reading?.confidence).toBeGreaterThan(0.9);
    },
  );

  it('stays within a couple of cents of the tone', () => {
    const reading = detect(440);
    const cents = 1200 * Math.log2((reading?.frequency ?? 0) / 440);
    expect(Math.abs(cents)).toBeLessThan(2);
  });

  it('reports the fundamental when the harmonics are stronger than it', () => {
    // A rich voice: the 2nd and 3rd harmonic louder than the fundamental.
    const reading = detect(220, [1.5, 1.2, 0.5]);
    expect(reading?.frequency).toBeCloseTo(220, 0);
  });

  it('reports the fundamental of a tone with a harmonic series', () => {
    const reading = detect(329.63, [0.5, 0.33, 0.25, 0.2]);
    expect(reading?.frequency).toBeCloseTo(329.63, 0);
  });

  it('hears nothing in silence', () => {
    expect(detectPitchYin(new Float32Array(LENGTH), SAMPLE_RATE)).toBeNull();
  });

  it('hears nothing in a whisper below the silence gate', () => {
    const quiet = syntheticTone({
      frequency: 440,
      sampleRate: SAMPLE_RATE,
      length: LENGTH,
      amplitude: 0.005,
    });
    expect(detectPitchYin(quiet, SAMPLE_RATE)).toBeNull();
  });

  it('is unsure of noise', () => {
    let seed = 1;
    const noise = new Float32Array(LENGTH).map(() => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647 - 0.5) * 0.8;
    });
    const reading = detectPitchYin(noise, SAMPLE_RATE);
    expect(reading === null || reading.confidence < 0.85).toBe(true);
  });

  it('works at 44.1 kHz too', () => {
    const tone = syntheticTone({
      frequency: 300,
      sampleRate: 44_100,
      length: LENGTH,
    });
    expect(detectPitchYin(tone, 44_100)?.frequency).toBeCloseTo(300, 0);
  });
});
