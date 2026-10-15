import type { PitchReading } from './yin';

/** CREPE reads 1024 samples of 16 kHz audio and answers 360 pitch bins. */
export const CREPE_RATE = 16_000;
export const CREPE_FRAME = 1024;

/** The pitch of bin 0 in cents above 10 Hz, and the width of a bin. */
const CENTS_OFFSET = 1997.3794084376191;
const CENTS_PER_BIN = 20;

/** Bins either side of the strongest one that are averaged into the answer. */
const NEIGHBOURS = 4;

/** CREPE is trained on frames with zero mean and unit variance. */
export function normalizeFrame(samples: Float32Array): Float32Array {
  let mean = 0;
  for (const sample of samples) mean += sample;
  mean /= samples.length;
  let variance = 0;
  for (const sample of samples) variance += (sample - mean) ** 2;
  const deviation = Math.max(Math.sqrt(variance / samples.length), 1e-10);
  return samples.map((sample) => (sample - mean) / deviation);
}

/**
 * The pitch CREPE heard: the strongest bin, refined by a weighted average of
 * its neighbours (as the CREPE paper does), and how strong that bin was.
 */
export function decodeActivation(
  probabilities: ArrayLike<number>,
): PitchReading | null {
  if (probabilities.length === 0) return null;
  let best = 0;
  for (let bin = 1; bin < probabilities.length; bin += 1) {
    if ((probabilities[bin] ?? 0) > (probabilities[best] ?? 0)) best = bin;
  }
  const from = Math.max(0, best - NEIGHBOURS);
  const to = Math.min(probabilities.length - 1, best + NEIGHBOURS);
  let weighted = 0;
  let total = 0;
  for (let bin = from; bin <= to; bin += 1) {
    const weight = probabilities[bin] ?? 0;
    weighted += weight * bin;
    total += weight;
  }
  if (total === 0) return null;
  const cents = CENTS_PER_BIN * (weighted / total) + CENTS_OFFSET;
  return {
    frequency: 10 * 2 ** (cents / 1200),
    confidence: probabilities[best] ?? 0,
  };
}
