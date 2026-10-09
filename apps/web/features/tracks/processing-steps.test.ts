import { describe, expect, it } from 'vitest';

import {
  displayedPercent,
  progressPercent,
  remainingMinutes,
  type StepState,
  stepPosition,
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

describe('stepPosition', () => {
  it('counts the running step from 1, out of every step', () => {
    expect(stepPosition('FINDING_VIDEO', null)).toEqual({
      number: 1,
      total: 5,
    });
    expect(stepPosition('EXTRACTING_VOCALS', null)).toEqual({
      number: 3,
      total: 5,
    });
    expect(stepPosition('EXTRACTING_LYRICS', null)).toEqual({
      number: 5,
      total: 5,
    });
  });

  it('names the step a failed Processing stopped at', () => {
    expect(stepPosition('FAILED', 'DETECTING_NOTES')).toEqual({
      number: 4,
      total: 5,
    });
  });

  it('has no step while queued, once completed, or for a failure at an unknown step', () => {
    expect(stepPosition('QUEUED', null)).toBeNull();
    expect(stepPosition('QUEUED', 'DOWNLOADING_AUDIO')).toBeNull();
    expect(stepPosition('COMPLETED', null)).toBeNull();
    expect(stepPosition('FAILED', null)).toBeNull();
  });
});

describe('remainingMinutes', () => {
  it('adds the usual time of the running step and of every later one', () => {
    // 5 + 25 + 50 + 39 + 36 s, then fewer steps left each time.
    expect(remainingMinutes('FINDING_VIDEO', 0)).toBe(3);
    expect(remainingMinutes('DOWNLOADING_AUDIO', 0)).toBe(3);
    expect(remainingMinutes('EXTRACTING_VOCALS', 0)).toBe(2);
    expect(remainingMinutes('DETECTING_NOTES', 0)).toBe(1);
    expect(remainingMinutes('EXTRACTING_LYRICS', 0)).toBe(1);
  });

  it('takes the time already spent off the running step', () => {
    // 30 s left of the vocals plus 75 s of the later steps.
    expect(remainingMinutes('EXTRACTING_VOCALS', 20_000)).toBe(2);
    // 10 s left of the vocals plus 75 s.
    expect(remainingMinutes('EXTRACTING_VOCALS', 40_000)).toBe(1);
  });

  it('rounds to the nearest whole minute', () => {
    expect(remainingMinutes('EXTRACTING_LYRICS', 6_000)).toBe(1);
    expect(remainingMinutes('EXTRACTING_LYRICS', 7_000)).toBe(0);
  });

  it('counts an overrunning step as done, keeping the later steps', () => {
    expect(remainingMinutes('EXTRACTING_LYRICS', DAY_MS)).toBe(0);
    expect(remainingMinutes('DETECTING_NOTES', DAY_MS)).toBe(1);
  });

  it('treats a negative elapsed time as none', () => {
    expect(remainingMinutes('EXTRACTING_LYRICS', -60_000)).toBe(1);
  });

  it('has no estimate when nothing runs', () => {
    expect(remainingMinutes('QUEUED', 0)).toBeNull();
    expect(remainingMinutes('COMPLETED', 0)).toBeNull();
    expect(remainingMinutes('FAILED', 0)).toBeNull();
  });
});
