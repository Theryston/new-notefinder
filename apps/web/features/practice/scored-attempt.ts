import {
  PRACTICE_SPEEDS,
  type SubmitPracticeAttemptBody,
  type TrackNote,
} from '@notefinder/contracts';

import { type BleedSample, suspectBleed } from './bleed';
import type { PracticeScore, ScoringSettings } from './scoring';

type AttemptSummary = ReturnType<PracticeScore['summary']>;

/** How many recent voice readings the bleed flag judges by. */
export const MAX_ATTEMPT_SAMPLES = 30_000;

const isPracticeSpeed = (
  rate: number,
): rate is (typeof PRACTICE_SPEEDS)[number] =>
  (PRACTICE_SPEEDS as readonly number[]).includes(rate);

/**
 * Records one voice reading for the bleed flag. Silence (`undefined`, or a
 * reading without pitch) still counts: the flag judges steadiness, and gaps
 * are part of it. Oldest readings drop past `max`.
 */
export function collectVoiceSample(
  samples: BleedSample[],
  reading: { time: number; midi: number | null } | undefined,
  max = MAX_ATTEMPT_SAMPLES,
): void {
  if (reading === undefined) return;
  samples.push({ time: reading.time, midi: reading.midi });
  if (samples.length > max) samples.splice(0, samples.length - max);
}

/**
 * The attempt a finished run saves, or null when nothing should be reported:
 * the run is still open, it already reported (only a fresh finish, nothing
 * before it, reports, so changing a setting with the sheet open never saves
 * the run twice), the scoring would never submit it, or its window is gone.
 */
export function buildScoredAttemptBody({
  result,
  previous,
  settings,
  transpose,
  rate,
  samples,
  notes,
  window,
}: {
  result: AttemptSummary | null;
  /** The last result seen. */
  previous: unknown;
  settings: ScoringSettings;
  transpose: number;
  rate: number;
  samples: readonly BleedSample[];
  notes: readonly TrackNote[];
  window: { startedAt: number; endedAt: number } | null;
}): SubmitPracticeAttemptBody | null {
  if (previous !== null || result === null || !result.submittable) return null;
  if (!window) return null;
  return {
    difficulty: settings.difficulty,
    octaveMode: settings.octaveMode,
    transposeSemitones: transpose,
    speed: isPracticeSpeed(rate) ? rate : 1,
    accuracy: result.accuracy,
    coverage: result.coverage,
    forwardSkip: result.forwardSkip,
    bleedSuspected: suspectBleed(samples, notes),
    startedAt: new Date(window.startedAt).toISOString(),
    endedAt: new Date(window.endedAt).toISOString(),
  };
}
