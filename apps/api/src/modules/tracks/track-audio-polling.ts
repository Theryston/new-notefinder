import { z } from 'zod';

// The re-checks of a RapidAPI conversion (ADR 0004). A conversion is polled
// once every 10 seconds, at most 180 times: the legacy service's budget, about
// 30 minutes. A conversion still running at the last check fails the download.

export const AUDIO_POLL_INTERVAL_MS = 10_000;
const AUDIO_MAX_POLLS = 180;

/** What a re-check carries from the run before it: the conversion's progress URL. */
export const audioWaitStateSchema = z.object({
  progressUrl: z.url(),
});

/**
 * Whether a re-check that finds the conversion still running has used up the
 * budget. `round` counts the checks, from 1.
 */
export const isPollBudgetSpent = (round: number): boolean =>
  round >= AUDIO_MAX_POLLS;
