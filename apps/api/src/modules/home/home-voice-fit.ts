import type { TrackVocalRange } from '@vozzify/contracts';

/** A song may need at most this many semitones of transposition to fit. */
export const MAX_VOICE_TRANSPOSITION_SEMITONES = 3;

/** The smallest useful edge beyond a User's range for a challenge Track. */
export const MIN_CHALLENGE_OVERRUN_SEMITONES = 1;

/** The challenge row stays close enough to feel achievable. */
export const MAX_CHALLENGE_OVERRUN_SEMITONES = 3;

/**
 * The smallest signed shift that places the full Track range inside the User's
 * range. A Track wider than the User's range cannot fit by transposition.
 */
export const voiceTransposeSemitones = (
  user: TrackVocalRange,
  track: TrackVocalRange,
): number | null => {
  const userSpan = user.highest - user.lowest;
  const trackSpan = track.highest - track.lowest;
  if (trackSpan > userSpan) {
    return null;
  }

  const lowestAllowedShift = user.lowest - track.lowest;
  const highestAllowedShift = user.highest - track.highest;
  if (lowestAllowedShift <= 0 && highestAllowedShift >= 0) {
    return 0;
  }
  return lowestAllowedShift > 0 ? lowestAllowedShift : highestAllowedShift;
};

/**
 * A bounded fit score: exact fits score 1, and each semitone of transposition
 * lowers the score by an equal step. Unreachable or larger shifts score 0.
 */
export const voiceFitScore = (
  user: TrackVocalRange,
  track: TrackVocalRange,
): number => {
  const shift = voiceTransposeSemitones(user, track);
  if (shift === null || Math.abs(shift) > MAX_VOICE_TRANSPOSITION_SEMITONES) {
    return 0;
  }
  return 1 - Math.abs(shift) / (MAX_VOICE_TRANSPOSITION_SEMITONES + 1);
};

/**
 * How far a Track reaches beyond one edge of the User's range. Disjoint ranges
 * qualify when their gap is small; a Track beyond both edges does not.
 */
export const challengeOverrun = (
  user: TrackVocalRange,
  track: TrackVocalRange,
): number | null => {
  const below = Math.max(0, user.lowest - track.lowest);
  const above = Math.max(0, track.highest - user.highest);
  const greatestOverrun = Math.max(below, above);
  return greatestOverrun >= MIN_CHALLENGE_OVERRUN_SEMITONES &&
    greatestOverrun <= MAX_CHALLENGE_OVERRUN_SEMITONES
    ? greatestOverrun
    : null;
};
