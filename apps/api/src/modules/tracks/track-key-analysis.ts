import type { TrackNote } from '@notefinder/contracts';

const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

export type TrackKeyAnalysis = {
  vocalRange: { lowMidi: number; highMidi: number } | null;
  estimatedKey: { tonic: number; mode: 'MAJOR' | 'MINOR' } | null;
};

/** Computes the range and Krumhansl-Schmuckler key from duration-weighted notes. */
export function analyzeTrackNotes(
  notes: readonly TrackNote[],
): TrackKeyAnalysis {
  if (notes.length === 0) return { vocalRange: null, estimatedKey: null };

  const histogram = Array.from({ length: 12 }, () => 0);
  let lowMidi = Number.POSITIVE_INFINITY;
  let highMidi = Number.NEGATIVE_INFINITY;
  for (const note of notes) {
    lowMidi = Math.min(lowMidi, note.pitch);
    highMidi = Math.max(highMidi, note.pitch);
    const duration = Math.max(0, note.end - note.start);
    const pitchClass = ((Math.round(note.pitch) % 12) + 12) % 12;
    histogram[pitchClass] = (histogram[pitchClass] ?? 0) + duration;
  }

  const estimatedKey = histogram.every((weight) => weight === 0)
    ? null
    : findKey(histogram);
  return { vocalRange: { lowMidi, highMidi }, estimatedKey };
}

function findKey(histogram: readonly number[]) {
  const candidates = [
    ...MAJOR_PROFILE.map((_, tonic) => ({
      profile: MAJOR_PROFILE,
      tonic,
      mode: 'MAJOR' as const,
    })),
    ...MINOR_PROFILE.map((_, tonic) => ({
      profile: MINOR_PROFILE,
      tonic,
      mode: 'MINOR' as const,
    })),
  ];
  let winner: (typeof candidates)[number] = {
    profile: MAJOR_PROFILE,
    tonic: 0,
    mode: 'MAJOR',
  };
  let best = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const score = correlation(histogram, candidate.profile, candidate.tonic);
    if (score > best) {
      best = score;
      winner = candidate;
    }
  }
  return { tonic: winner.tonic, mode: winner.mode };
}

function correlation(
  histogram: readonly number[],
  profile: readonly number[],
  tonic: number,
): number {
  const values = histogram.map(
    (_, index) => histogram[(index + tonic) % 12] ?? 0,
  );
  const meanValues = values.reduce((sum, value) => sum + value, 0) / 12;
  const meanProfile = profile.reduce((sum, value) => sum + value, 0) / 12;
  let covariance = 0;
  let valuesVariance = 0;
  let profileVariance = 0;
  for (let index = 0; index < 12; index += 1) {
    const valueDelta = (values[index] ?? 0) - meanValues;
    const profileDelta = (profile[index] ?? 0) - meanProfile;
    covariance += valueDelta * profileDelta;
    valuesVariance += valueDelta ** 2;
    profileVariance += profileDelta ** 2;
  }
  return covariance / Math.sqrt(valuesVariance * profileVariance);
}
