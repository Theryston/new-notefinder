import {
  PRACTICE_SPEEDS,
  type PracticeSpeed,
  type SubmitPracticeAttemptBody,
  type TrackNote,
} from '@vozzify/contracts';

import { type BleedSample, suspectBleed } from './bleed';
import type { PracticeScore, ScoringSettings } from './scoring';

type AttemptSummary = ReturnType<PracticeScore['summary']>;

/** How many recent voice readings the bleed flag judges by. */
export const MAX_ATTEMPT_SAMPLES = 30_000;

/**
 * The dock speed a run reports. The playback store only ever holds the
 * dock's own speeds (the Settings menu offers nothing else), so this is the
 * identity in practice; anything else rounds to the nearest dock speed
 * instead of saving a speed the run never sang at.
 */
export function nearestPracticeSpeed(rate: number): PracticeSpeed {
  let nearest: PracticeSpeed = PRACTICE_SPEEDS[0] ?? 1;
  for (const speed of PRACTICE_SPEEDS) {
    if (Math.abs(speed - rate) < Math.abs(nearest - rate)) nearest = speed;
  }
  return nearest;
}

/**
 * One voice reading with the wall clock it was collected on. The Track time
 * (`time`) places the reading on the notes for the bleed flag; the wall
 * clock (`at`) scopes readings to the run they were sung in.
 */
export type StampedSample = {
  time: number;
  midi: number | null;
  at: number;
};

/**
 * Records one voice reading for the bleed flag. Silence (`undefined`, or a
 * reading without pitch) still counts: the flag judges steadiness, and gaps
 * are part of it. Oldest readings drop past `max`.
 */
export function collectVoiceSample(
  samples: StampedSample[],
  reading: { time: number; midi: number | null } | undefined,
  at: number = Date.now(),
  max: number = MAX_ATTEMPT_SAMPLES,
): void {
  if (reading === undefined) return;
  samples.push({ ...reading, at });
  if (samples.length > max) samples.splice(0, samples.length - max);
}

/**
 * The readings collected while a run was open. A page collects across runs,
 * but the bleed flag judges one run: readings from an earlier run (or a
 * loop drill before it) must not mark this attempt.
 */
export function selectRunSamples(
  samples: readonly StampedSample[],
  window: { startedAt: number; endedAt: number } | null,
): BleedSample[] {
  if (!window) return [];
  return samples
    .filter(
      (sample) => sample.at >= window.startedAt && sample.at <= window.endedAt,
    )
    .map(({ time, midi }) => ({ time, midi }));
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
    speed: nearestPracticeSpeed(rate),
    accuracy: result.accuracy,
    coverage: result.coverage,
    forwardSkip: result.forwardSkip,
    bleedSuspected: suspectBleed(samples, notes),
    startedAt: new Date(window.startedAt).toISOString(),
    endedAt: new Date(window.endedAt).toISOString(),
  };
}
