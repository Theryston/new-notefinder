import { z } from 'zod';

// How an attempt's accuracy reads, shared by every client (the web profile
// history today, the mobile app later). See CONTEXT.md, "Accuracy band".

/** The band a run's accuracy falls in: hit, near or miss. */
const accuracyBandSchema = z.enum(['hit', 'near', 'miss']);

export type AccuracyBand = z.infer<typeof accuracyBandSchema>;

/** Accuracy (0 to 1) from which a run is a hit. */
const HIT_FROM = 0.85;

/** Accuracy (0 to 1) from which a run is near, below which it is a miss. */
const NEAR_FROM = 0.6;

/** The band of an accuracy from 0 to 1: at or above 85% a hit, at or above 60% near, below it a miss. */
export function accuracyBand(accuracy: number): AccuracyBand {
  if (accuracy >= HIT_FROM) return 'hit';
  if (accuracy >= NEAR_FROM) return 'near';
  return 'miss';
}
