import type { TrackKey } from '@notefinder/contracts';

// Krumhansl-Schmuckler key finding, as the legacy app did it: the pitch
// classes a Track sings, weighted by how long each is held, are correlated
// with the major and minor key profiles in each of the twelve rotations.

const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
] as const;

const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
] as const;

const PROFILES = [
  { mode: 'MAJOR', profile: MAJOR_PROFILE },
  { mode: 'MINOR', profile: MINOR_PROFILE },
] as const;

const PITCH_CLASSES = 12;

/** A note's pitch and the span it is held, which is all the key needs. */
type KeyNote = { pitch: number; start: number; end: number };

/** Seconds each pitch class is sung, from C (0) to B (11). */
function pitchClassHistogram(notes: readonly KeyNote[]): number[] {
  const histogram = Array.from({ length: PITCH_CLASSES }, () => 0);
  for (const note of notes) {
    const key = Math.floor(note.pitch + 0.5);
    const pitchClass = ((key % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
    histogram[pitchClass] =
      (histogram[pitchClass] ?? 0) + Math.max(0, note.end - note.start);
  }
  return histogram;
}

/** Pearson correlation of two equally long series; 0 when either is flat. */
function correlation(a: readonly number[], b: readonly number[]): number {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  a.forEach((value, index) => {
    const deltaA = value - meanA;
    const deltaB = (b[index] ?? 0) - meanB;
    covariance += deltaA * deltaB;
    varianceA += deltaA * deltaA;
    varianceB += deltaB * deltaB;
  });
  const spread = Math.sqrt(varianceA * varianceB);
  return spread === 0 ? 0 : covariance / spread;
}

/**
 * The key a set of vocal notes is most likely in, or null when they hold no
 * sound (no notes, or only zero-length ones), since there is nothing to judge.
 */
export function estimateKey(notes: readonly KeyNote[]): TrackKey | null {
  const histogram = pitchClassHistogram(notes);
  if (histogram.every((seconds) => seconds === 0)) {
    return null;
  }
  let best: { key: TrackKey; score: number } | null = null;
  for (let tonic = 0; tonic < PITCH_CLASSES; tonic += 1) {
    // The histogram seen from this tonic, so the profile's first value is the tonic.
    const fromTonic = histogram.map(
      (_, index) => histogram[(index + tonic) % PITCH_CLASSES] ?? 0,
    );
    for (const { mode, profile } of PROFILES) {
      const score = correlation(fromTonic, profile);
      if (best === null || score > best.score) {
        best = { key: { tonic, mode }, score };
      }
    }
  }
  return best?.key ?? null;
}
