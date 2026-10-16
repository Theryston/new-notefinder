import { describe, expect, it } from 'vitest';

import {
  buildScoredAttemptBody,
  collectVoiceSample,
  MAX_ATTEMPT_SAMPLES,
  nearestPracticeSpeed,
  type StampedSample,
  selectRunSamples,
} from './scored-attempt';

const notes = [
  { pitch: 69, start: 0, end: 1 },
  { pitch: 69, start: 1, end: 2 },
];

const submittable = {
  accuracy: 0.8,
  judged: 2,
  hits: 2,
  coverage: 1,
  forwardSkip: false,
  loop: false,
  submittable: true,
};

const run = {
  settings: { difficulty: 'NORMAL', octaveMode: 'ANY' },
  transpose: -2,
  rate: 1,
  samples: [] as StampedSample[],
  notes,
  window: {
    startedAt: new Date('2026-10-16T10:00:00.000Z').getTime(),
    endedAt: new Date('2026-10-16T10:04:00.000Z').getTime(),
  },
} as const;

describe('buildScoredAttemptBody', () => {
  it('reports a fresh valid run with what shaped it and how it went', () => {
    expect(
      buildScoredAttemptBody({ ...run, result: submittable, previous: null }),
    ).toEqual({
      difficulty: 'NORMAL',
      octaveMode: 'ANY',
      transposeSemitones: -2,
      speed: 1,
      accuracy: 0.8,
      coverage: 1,
      forwardSkip: false,
      bleedSuspected: false,
      startedAt: '2026-10-16T10:00:00.000Z',
      endedAt: '2026-10-16T10:04:00.000Z',
    });
  });

  it('reports nothing without a fresh finish', () => {
    expect(
      buildScoredAttemptBody({ ...run, result: null, previous: null }),
    ).toBeNull();
    // Changing a setting with the sheet open republishes the same run: the
    // run already reported, so it must not save twice.
    expect(
      buildScoredAttemptBody({
        ...run,
        result: submittable,
        previous: submittable,
      }),
    ).toBeNull();
  });

  it('reports nothing the scoring would never submit', () => {
    expect(
      buildScoredAttemptBody({
        ...run,
        result: { ...submittable, coverage: 0.5, submittable: false },
        previous: null,
      }),
    ).toBeNull();
    expect(
      buildScoredAttemptBody({
        ...run,
        result: { ...submittable, forwardSkip: true, submittable: false },
        previous: null,
      }),
    ).toBeNull();
    expect(
      buildScoredAttemptBody({
        ...run,
        result: { ...submittable, loop: true, submittable: false },
        previous: null,
      }),
    ).toBeNull();
  });

  it('reports nothing without a run window', () => {
    expect(
      buildScoredAttemptBody({
        ...run,
        result: submittable,
        previous: null,
        window: null,
      }),
    ).toBeNull();
  });

  it('rounds a rate the dock never offers to the nearest dock speed', () => {
    expect(
      buildScoredAttemptBody({
        ...run,
        result: submittable,
        previous: null,
        rate: 2,
      }),
    ).toMatchObject({ speed: 1.5 });
  });
});

describe('collectVoiceSample', () => {
  it('keeps voiced and unvoiced readings with their wall clock, oldest first', () => {
    const samples: StampedSample[] = [];

    collectVoiceSample(samples, { time: 1, midi: 69 }, 1000);
    collectVoiceSample(samples, { time: 2, midi: null }, 2000);
    collectVoiceSample(samples, undefined, 3000);

    expect(samples).toEqual([
      { time: 1, midi: 69, at: 1000 },
      { time: 2, midi: null, at: 2000 },
    ]);
  });

  it('drops the oldest readings past the bound', () => {
    const samples: StampedSample[] = [];

    for (let time = 0; time < MAX_ATTEMPT_SAMPLES + 10; time += 1) {
      collectVoiceSample(samples, { time, midi: 69 }, time);
    }

    expect(samples).toHaveLength(MAX_ATTEMPT_SAMPLES);
    expect(samples[0]).toEqual({ time: 10, midi: 69, at: 10 });
  });
});

describe('selectRunSamples', () => {
  const window = { startedAt: 1000, endedAt: 2000 };

  it('keeps only what was collected while the run was open', () => {
    const samples: StampedSample[] = [
      // An earlier run leaking a steady A4 through the silence.
      { time: 5, midi: 69, at: 500 },
      { time: 0.5, midi: 69, at: 1000 },
      { time: 0.6, midi: 69, at: 2000 },
      // A loop drill after the finish.
      { time: 0.5, midi: 69, at: 2001 },
    ];

    expect(selectRunSamples(samples, window)).toEqual([
      { time: 0.5, midi: 69 },
      { time: 0.6, midi: 69 },
    ]);
  });

  it('selects nothing without a run window', () => {
    expect(selectRunSamples([{ time: 0.5, midi: 69, at: 1500 }], null)).toEqual(
      [],
    );
  });
});

describe('nearestPracticeSpeed', () => {
  it('keeps the dock speeds as they are', () => {
    for (const speed of [0.5, 0.75, 1, 1.25, 1.5] as const) {
      expect(nearestPracticeSpeed(speed)).toBe(speed);
    }
  });

  it('rounds anything else to the nearest dock speed', () => {
    expect(nearestPracticeSpeed(0.6)).toBe(0.5);
    expect(nearestPracticeSpeed(1.4)).toBe(1.5);
    expect(nearestPracticeSpeed(2)).toBe(1.5);
  });
});
