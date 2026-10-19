/** The word and the dot of an accuracy chip; never shown by color alone. */
export type AccuracyStatus = 'hit' | 'near' | 'miss';

/**
 * Accuracy (hit notes divided by judged notes, 0 to 1) from which a run reads
 * as a hit, and from which it reads as near. Product thresholds: the hit
 * threshold matches the 85% a run needs to count toward a Vocal range.
 */
const HIT_FROM = 0.85;
const NEAR_FROM = 0.6;

/** The status word a run's accuracy reads as. */
export function accuracyStatus(accuracy: number): AccuracyStatus {
  if (accuracy >= HIT_FROM) return 'hit';
  if (accuracy >= NEAR_FROM) return 'near';
  return 'miss';
}

/** The accuracy as the whole percentage shown next to its status. */
export function accuracyPercent(accuracy: number): number {
  return Math.round(accuracy * 100);
}
