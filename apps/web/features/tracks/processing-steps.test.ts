import { describe, expect, it } from 'vitest';

import {
  displayedPercent,
  progressPercent,
  type StepState,
  stepStates,
} from './processing-steps';

const RUNNING_STEPS = [
  'FINDING_VIDEO',
  'DOWNLOADING_AUDIO',
  'EXTRACTING_VOCALS',
  'DETECTING_NOTES',
  'EXTRACTING_LYRICS',
] as const;

const DAY_MS = 24 * 60 * 60_000;

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

describe('displayedPercent', () => {
  it('starts a step at the value the step starts at', () => {
    expect(displayedPercent('DOWNLOADING_AUDIO', null, 0)).toBe(30);
    expect(displayedPercent('EXTRACTING_VOCALS', null, 0)).toBe(50);
  });

  it('creeps toward the next step: about 63% of the gap after the time constant', () => {
    // 30 + (50 - 30) * (1 - e^-1), floored.
    expect(displayedPercent('DOWNLOADING_AUDIO', null, 40_000)).toBe(42);
    // 0 + (10 - 0) * (1 - e^-1), floored.
    expect(displayedPercent('QUEUED', null, 40_000)).toBe(6);
  });

  it('never moves backwards while the step runs', () => {
    for (const status of RUNNING_STEPS) {
      const samples = Array.from({ length: 601 }, (_, second) =>
        displayedPercent(status, null, second * 1_000),
      );
      expect([...samples].sort((a, b) => a - b)).toEqual(samples);
    }
  });

  it('never reaches the next step by itself, however long the step runs', () => {
    expect(displayedPercent('QUEUED', null, DAY_MS)).toBe(9);
    expect(displayedPercent('DOWNLOADING_AUDIO', null, DAY_MS)).toBe(49);
    expect(displayedPercent('EXTRACTING_LYRICS', null, DAY_MS)).toBe(99);
  });

  it.each([
    ['FINDING_VIDEO', 'DOWNLOADING_AUDIO'],
    ['DOWNLOADING_AUDIO', 'EXTRACTING_VOCALS'],
    ['EXTRACTING_VOCALS', 'DETECTING_NOTES'],
    ['DETECTING_NOTES', 'EXTRACTING_LYRICS'],
  ] as const)(
    'keeps %s below the start of %s, so a status change is a jump forward',
    (status, next) => {
      expect(displayedPercent(status, null, DAY_MS)).toBeLessThan(
        displayedPercent(next, null, 0),
      );
    },
  );

  it('treats a negative elapsed time as none', () => {
    expect(displayedPercent('DOWNLOADING_AUDIO', null, -5_000)).toBe(30);
  });

  it('holds a completed Processing at 100 and a failed one where it stopped', () => {
    expect(displayedPercent('COMPLETED', null, DAY_MS)).toBe(100);
    expect(displayedPercent('FAILED', 'DOWNLOADING_AUDIO', DAY_MS)).toBe(30);
    expect(displayedPercent('FAILED', null, DAY_MS)).toBe(0);
  });
});
