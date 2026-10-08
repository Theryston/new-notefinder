import { describe, expect, it } from 'vitest';

import {
  progressPercent,
  type StepState,
  stepStates,
} from './processing-steps';

const statesOf = (
  status: Parameters<typeof stepStates>[0],
  resumeFrom: Parameters<typeof stepStates>[1] = null,
): StepState[] => stepStates(status, resumeFrom).map((view) => view.state);

describe('stepStates', () => {
  it('shows every step waiting while the Processing is queued', () => {
    expect(statesOf('QUEUED')).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('marks the steps before the running one done and the running one current', () => {
    expect(statesOf('EXTRACTING_VOCALS')).toEqual([
      'done',
      'done',
      'current',
      'pending',
      'pending',
    ]);
  });

  it('marks the first step current as soon as it starts', () => {
    expect(statesOf('FINDING_VIDEO')).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('shows every step done once the Processing completed', () => {
    expect(statesOf('COMPLETED')).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done',
    ]);
  });

  it('marks the step a failed Processing stopped at, with the ones before it done', () => {
    expect(statesOf('FAILED', 'DETECTING_NOTES')).toEqual([
      'done',
      'done',
      'done',
      'failed',
      'pending',
    ]);
  });

  it('keeps every step waiting when a failure has no step to resume from', () => {
    expect(statesOf('FAILED', null)).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('names each step in run order, whatever its state', () => {
    expect(stepStates('QUEUED', null).map((view) => view.step)).toEqual([
      'FINDING_VIDEO',
      'DOWNLOADING_AUDIO',
      'EXTRACTING_VOCALS',
      'DETECTING_NOTES',
      'EXTRACTING_LYRICS',
    ]);
  });
});

describe('progressPercent', () => {
  it('is nothing while queued and everything once completed', () => {
    expect(progressPercent('QUEUED', null)).toBe(0);
    expect(progressPercent('COMPLETED', null)).toBe(100);
  });

  it('rises with each step, to the start of the step it is on', () => {
    const running = [
      'FINDING_VIDEO',
      'DOWNLOADING_AUDIO',
      'EXTRACTING_VOCALS',
      'DETECTING_NOTES',
      'EXTRACTING_LYRICS',
    ] as const;
    const percents = running.map((status) => progressPercent(status, null));

    expect(percents).toEqual([10, 30, 50, 75, 90]);
    expect([...percents].sort((a, b) => a - b)).toEqual(percents);
  });

  it('stays at the step a failed Processing stopped at', () => {
    expect(progressPercent('FAILED', 'DOWNLOADING_AUDIO')).toBe(30);
  });

  it('is nothing for a failure with no step to resume from', () => {
    expect(progressPercent('FAILED', null)).toBe(0);
  });
});
