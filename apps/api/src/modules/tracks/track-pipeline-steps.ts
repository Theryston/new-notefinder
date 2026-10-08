import {
  TRACK_PROCESSING_STEPS,
  type TrackProcessingStatus,
  type TrackProcessingStep,
} from '@notefinder/contracts';

// The order of a Processing's steps as this build runs them (pure). A later
// ticket appends its step to PIPELINE_STEPS, and the runner ends the
// Processing after the last step that exists.

/** The steps this build runs, in order. */
const PIPELINE_STEPS: readonly TrackProcessingStep[] = ['FINDING_VIDEO'];

/** A queued Processing is before every step. */
const STATUS_ORDER: readonly string[] = ['QUEUED', ...TRACK_PROCESSING_STEPS];

/** The first step a Processing runs. */
export function firstPipelineStep(): TrackProcessingStep {
  const [first] = PIPELINE_STEPS;
  if (first === undefined) {
    throw new Error('The Processing pipeline has no steps');
  }
  return first;
}

/** The step after this one, or undefined when it is the last. */
export function nextPipelineStep(
  step: TrackProcessingStep,
): TrackProcessingStep | undefined {
  const index = PIPELINE_STEPS.indexOf(step);
  return index === -1 ? undefined : PIPELINE_STEPS[index + 1];
}

/**
 * Whether a step job still has work to do: the Processing is queued or in
 * this step (a job that ran before a crash runs it again), not past it. A
 * terminal Processing has nothing due, so a replayed job is a no-op.
 */
export function isStepDue(
  status: TrackProcessingStatus,
  step: TrackProcessingStep,
): boolean {
  const statusIndex = STATUS_ORDER.indexOf(status);
  return statusIndex !== -1 && statusIndex <= STATUS_ORDER.indexOf(step);
}
