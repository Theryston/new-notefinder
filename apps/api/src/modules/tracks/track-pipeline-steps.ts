import {
  TRACK_PROCESSING_STEPS,
  type TrackProcessingStatus,
  type TrackProcessingStep,
} from '@notefinder/contracts';

// The order of a Processing's steps as this build runs them (pure). A later
// ticket appends its step here and adds its handler to TrackPipelineService;
// the handler map is typed on this list, so a step without one does not
// compile.

const PIPELINE_STEPS = [
  'FINDING_VIDEO',
  'DOWNLOADING_AUDIO',
  'EXTRACTING_VOCALS',
  'DETECTING_NOTES',
] as const satisfies readonly TrackProcessingStep[];

/** A step this build runs. */
export type PipelineStepName = (typeof PIPELINE_STEPS)[number];

/**
 * The step a retry resumes at after a failure in `step`. The note detection is
 * one RunPod job, and a retry does not carry a failed job over, so a failure in
 * either of its stages starts it again from the vocals stage.
 */
export const resumeStepOf = (step: TrackProcessingStep): TrackProcessingStep =>
  step === 'DETECTING_NOTES' ? 'EXTRACTING_VOCALS' : step;

/** A queued Processing is before every step. */
const STATUS_ORDER: readonly TrackProcessingStatus[] = [
  'QUEUED',
  ...TRACK_PROCESSING_STEPS,
];

/** Whether a step job is one this build runs (a later ticket's step is not). */
export const isPipelineStep = (
  step: TrackProcessingStep,
): step is PipelineStepName =>
  (PIPELINE_STEPS as readonly TrackProcessingStep[]).includes(step);

/** The first step a Processing runs. */
export const firstPipelineStep = (): PipelineStepName => PIPELINE_STEPS[0];

/** The step after this one, or undefined when it is the last. */
export function nextPipelineStep(
  step: PipelineStepName,
): PipelineStepName | undefined {
  const index = PIPELINE_STEPS.indexOf(step);
  return index === -1 ? undefined : PIPELINE_STEPS[index + 1];
}

/**
 * The statuses a step's job may run in: queued, the step itself, or a step
 * before it. A Processing in any other status is past the step (or ended), so
 * the job must leave it alone.
 */
export function dueStatusesOf(
  step: TrackProcessingStep,
): TrackProcessingStatus[] {
  const index = STATUS_ORDER.indexOf(step);
  return STATUS_ORDER.slice(0, index + 1);
}

/**
 * Whether a step job still has work to do: the Processing is queued or in
 * this step (a job that ran before a crash runs it again), not past it. A
 * terminal Processing has nothing due, so a replayed job is a no-op.
 */
export const isStepDue = (
  status: TrackProcessingStatus,
  step: TrackProcessingStep,
): boolean => dueStatusesOf(step).includes(status);
