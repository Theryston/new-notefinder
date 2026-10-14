import { describe, expect, it } from 'vitest';

import { HOP_SIZE, PitchPipeline, WINDOW_SIZE } from './pitch-pipeline';
import { syntheticTone } from './synthetic-tone';

const SAMPLE_RATE = 48_000;
/** The audio thread hands over 128-sample blocks. */
const BLOCK = 128;

function sing(
  pipeline: PitchPipeline,
  frequency: number,
  seconds: number,
  startSample = 0,
) {
  const readings: (number | null)[] = [];
  const total = Math.round(seconds * SAMPLE_RATE);
  for (let at = 0; at < total; at += BLOCK) {
    const block = syntheticTone({
      frequency,
      sampleRate: SAMPLE_RATE,
      length: BLOCK,
      harmonics: [0.6, 0.3],
      start: startSample + at,
    });
    for (const reading of pipeline.feed(block)) readings.push(reading.midi);
  }
  return readings;
}

describe('PitchPipeline', () => {
  it('gives one reading for every hop of samples', () => {
    const pipeline = new PitchPipeline(SAMPLE_RATE);
    expect(sing(pipeline, 440, 1)).toHaveLength(
      Math.floor(SAMPLE_RATE / HOP_SIZE),
    );
  });

  it('reads the note being sung through block boundaries', () => {
    const pipeline = new PitchPipeline(SAMPLE_RATE);
    const readings = sing(pipeline, 440, 0.5);
    expect(readings.at(-1)).toBeCloseTo(69, 1);
  });

  it('follows the singer to a new note', () => {
    const pipeline = new PitchPipeline(SAMPLE_RATE);
    sing(pipeline, 220, 0.4);
    const readings = sing(pipeline, 261.63, 0.4, 0.4 * SAMPLE_RATE);
    expect(readings.at(-1)).toBeCloseTo(60, 1);
  });

  it('reports silence as null', () => {
    const pipeline = new PitchPipeline(SAMPLE_RATE);
    const readings = pipeline.feed(new Float32Array(WINDOW_SIZE));
    expect(readings.every((reading) => reading.midi === null)).toBe(true);
  });

  it('accepts a block larger than a hop', () => {
    const pipeline = new PitchPipeline(SAMPLE_RATE);
    const readings = pipeline.feed(new Float32Array(HOP_SIZE * 3 + 1));
    expect(readings).toHaveLength(3);
  });

  it('knows how long a window of its sample rate is', () => {
    expect(new PitchPipeline(48_000).windowSeconds).toBeCloseTo(0.0427, 3);
    expect(new PitchPipeline(16_000).windowSeconds).toBeCloseTo(0.128, 3);
  });
});
