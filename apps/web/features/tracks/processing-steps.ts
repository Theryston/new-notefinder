import {
  TRACK_PROCESSING_STEPS,
  type TrackProcessingStatus,
  type TrackProcessingStep,
} from '@notefinder/contracts';

/** Where one step of a Processing stands, as the step list shows it. */
export type StepState = 'done' | 'current' | 'pending' | 'failed';

export type StepView = { step: TrackProcessingStep; state: StepState };

/**
 * The bar's percentage once each step starts. The bar eases to it with CSS, so
 * these fixed values are all the progress the page knows.
 */
const PERCENT_WHEN_STARTED: Record<TrackProcessingStep, number> = {
  FINDING_VIDEO: 10,
  DOWNLOADING_AUDIO: 30,
  EXTRACTING_VOCALS: 50,
  DETECTING_NOTES: 75,
  EXTRACTING_LYRICS: 90,
};

/**
 * The bar's target for a Processing: nothing while queued, everything once
 * completed, and the start of the step it is on (or stopped at) otherwise.
 */
export function progressPercent(
  status: TrackProcessingStatus,
  resumeFrom: TrackProcessingStep | null,
): number {
  if (status === 'COMPLETED') return 100;
  if (status === 'QUEUED') return 0;
  if (status === 'FAILED') {
    return resumeFrom === null ? 0 : PERCENT_WHEN_STARTED[resumeFrom];
  }
  return PERCENT_WHEN_STARTED[status];
}

/**
 * How far the steps have got: the steps before `doneBefore` are done, and the
 * one at `active` (if any) is in the given state.
 */
type Position = {
  doneBefore: number;
  active?: { index: number; state: 'current' | 'failed' };
};

function positionOf(
  status: TrackProcessingStatus,
  resumeFrom: TrackProcessingStep | null,
): Position {
  if (status === 'COMPLETED')
    return { doneBefore: TRACK_PROCESSING_STEPS.length };
  if (status === 'QUEUED') return { doneBefore: 0 };
  if (status === 'FAILED') {
    if (resumeFrom === null) return { doneBefore: 0 };
    const index = TRACK_PROCESSING_STEPS.indexOf(resumeFrom);
    return { doneBefore: index, active: { index, state: 'failed' } };
  }
  const index = TRACK_PROCESSING_STEPS.indexOf(status);
  return { doneBefore: index, active: { index, state: 'current' } };
}

function stateOf(index: number, position: Position): StepState {
  if (index < position.doneBefore) return 'done';
  if (position.active?.index === index) return position.active.state;
  return 'pending';
}

/**
 * Every step of the Processing with its state, in run order. A failed
 * Processing marks the step it stopped at (the one a retry resumes); without
 * that step known, the list shows every step as waiting.
 */
export function stepStates(
  status: TrackProcessingStatus,
  resumeFrom: TrackProcessingStep | null,
): StepView[] {
  const position = positionOf(status, resumeFrom);
  return TRACK_PROCESSING_STEPS.map((step, index) => ({
    step,
    state: stateOf(index, position),
  }));
}
