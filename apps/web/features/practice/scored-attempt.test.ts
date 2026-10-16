import { describe, expect, it } from 'vitest';
import type { BleedSample } from './bleed';
import {
  buildScoredAttemptBody,
  collectVoiceSample,
  MAX_ATTEMPT_SAMPLES,
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
  samples: [] as BleedSample[],
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

  it('falls back to full speed for a rate the dock never offers', () => {
    expect(
      buildScoredAttemptBody({
        ...run,
        result: submittable,
        previous: null,
        rate: 2,
      }),
    ).toMatchObject({ speed: 1 });
  });
});

describe('collectVoiceSample', () => {
  it('keeps voiced and unvoiced readings, oldest first', () => {
    const samples: BleedSample[] = [];

    collectVoiceSample(samples, { time: 1, midi: 69 });
    collectVoiceSample(samples, { time: 2, midi: null });
    collectVoiceSample(samples, undefined);

    expect(samples).toEqual([
      { time: 1, midi: 69 },
      { time: 2, midi: null },
    ]);
  });

  it('drops the oldest readings past the bound', () => {
    const samples: BleedSample[] = [];

    for (let time = 0; time < MAX_ATTEMPT_SAMPLES + 10; time += 1) {
      collectVoiceSample(samples, { time, midi: 69 });
    }

    expect(samples).toHaveLength(MAX_ATTEMPT_SAMPLES);
    expect(samples[0]).toEqual({ time: 10, midi: 69 });
  });
});
