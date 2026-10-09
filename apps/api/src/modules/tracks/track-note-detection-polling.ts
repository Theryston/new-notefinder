import type { RunpodJobState } from '../../integrations/note-detection/runpod-job.js';
import { isPollBudgetSpentAt } from './track-poll-budget.js';
import { failedWith, type StepOutcome, waitFor } from './track-step-outcome.js';

// The re-checks of a note detection job (ADR 0004). The job is polled every 5
// seconds, and a stage still running after 120 checks (10 minutes) ends the
// Processing. Each of the two stages that poll the job has this budget, so the
// job as a whole is bounded by 20 minutes.

export const NOTE_POLL_INTERVAL_MS = 5_000;
const NOTE_MAX_POLLS = 120;

/** A job the step checks again: it is still running, or it failed. */
export type UnfinishedJobState = Exclude<RunpodJobState, { kind: 'completed' }>;

/**
 * Whether a check that finds the job still running has used up the budget.
 * `round` counts the checks, from 1.
 */
export const isNotePollBudgetSpent = (round: number): boolean =>
  isPollBudgetSpentAt(round, NOTE_MAX_POLLS);

/** Whether the job is in its notes stage, which the vocals stage hands over to. */
export const isNotesStage = (state: RunpodJobState): boolean =>
  state.kind === 'running' && state.stage === 'DETECTING_NOTES';

/**
 * What a check that found the job unfinished leaves for the pipeline: a
 * failed job ends the Processing at once, a job still running past its budget
 * ends it too, and any other check is checked again later. A job that failed
 * on RunPod is final for that job, so BullMQ does not retry the same one; the
 * user's retry starts a new job.
 */
export const unfinishedOutcomeOf = (
  state: UnfinishedJobState,
  round: number,
): StepOutcome => {
  if (state.kind === 'failed' || isNotePollBudgetSpent(round)) {
    return failedWith('NOTE_DETECTION_FAILED');
  }
  return waitFor(NOTE_POLL_INTERVAL_MS, null);
};
