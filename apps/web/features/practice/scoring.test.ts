import { describe, expect, it } from 'vitest';
import { PracticeScore } from './scoring';

describe('practice scoring', () => {
  it('judges a transposed target from most voiced frames', () => {
    const score = new PracticeScore([{ pitch: 71, start: 0, end: 1 }]);
    score.record(0.1, 71);
    score.record(0.2, 71);
    score.record(0.3, 75);
    expect(score.summary().accuracy).toBe(1);
    expect(score.judgment(0)).toBe('hit');
  });
});

it.each([
  ['EASY', 0.75, 'hit'],
  ['EASY', 0.76, 'near'],
  ['NORMAL', 0.5, 'hit'],
  ['NORMAL', 0.51, 'near'],
  ['HARD', 0.25, 'hit'],
  ['HARD', 0.26, 'near'],
  ['HARD', 1, 'near'],
  ['HARD', 1.01, 'miss'],
] as const)(
  '%s classifies a %s semitone error as %s',
  (difficulty, delta, result) => {
    const score = new PracticeScore([{ pitch: 60, start: 0, end: 1 }]);
    score.record(0.5, 60 + delta);
    expect(score.judgment(0, { difficulty, octaveMode: 'EXACT' })).toBe(result);
  },
);

it('accepts pitch classes by default and measures octaves exactly when requested', () => {
  const score = new PracticeScore([{ pitch: 60, start: 0, end: 1 }]);
  score.record(0.5, 72);
  expect(score.judgment(0)).toBe('hit');
  expect(score.judgment(0, { difficulty: 'NORMAL', octaveMode: 'EXACT' })).toBe(
    'miss',
  );
});

it('does not judge silence or frames outside a note and resolves ties conservatively', () => {
  const score = new PracticeScore([{ pitch: 60, start: 1, end: 2 }]);
  score.record(0.5, 60);
  score.record(1.1, null);
  score.record(2, 60);
  expect(score.summary().judged).toBe(0);
  score.record(1.2, 60);
  score.record(1.3, 61);
  expect(score.judgment(0)).toBe('near');
});

it('computes accuracy over judged notes, note coverage and explicit forward seeks', () => {
  const score = new PracticeScore([
    { pitch: 60, start: 0, end: 1 },
    { pitch: 64, start: 1, end: 2 },
  ]);
  for (let tick = 0; tick < 200; tick += 1) score.record(tick / 100, 60);
  expect(score.summary()).toMatchObject({ accuracy: 0.5, submittable: true });
  expect(score.summary().coverage).toBe(1);
  score.seek(1, 0);
  expect(score.summary().forwardSkip).toBe(false);
  score.seek(0, 0.5);
  expect(score.summary()).toMatchObject({
    forwardSkip: true,
    submittable: false,
  });
});

it('never submits a loop', () => {
  const score = new PracticeScore([{ pitch: 60, start: 0, end: 1 }], true);
  score.record(0, 60);
  score.record(0.1, 60);
  score.record(0.9, 60);
  expect(score.summary()).toMatchObject({
    coverage: 1,
    loop: true,
    submittable: false,
  });
});

it('counts covered notes equally regardless of their durations and never double counts a replay', () => {
  const score = new PracticeScore([
    { pitch: 60, start: 0, end: 1 },
    { pitch: 60, start: 2, end: 100 },
  ]);
  score.record(0.5, 60);
  score.seek(0.5, 0);
  score.record(0.5, 60);
  expect(score.summary().coverage).toBe(0.5);
  expect(score.summary().submittable).toBe(false);
});

it('uses near and miss majorities rather than the final frame', () => {
  const near = new PracticeScore([{ pitch: 60, start: 0, end: 1 }]);
  near.record(0.1, 60.9);
  near.record(0.2, 60.8);
  near.record(0.3, 60);
  expect(near.judgment(0)).toBe('near');
  const miss = new PracticeScore([{ pitch: 60, start: 0, end: 1 }]);
  miss.record(0.1, 62);
  miss.record(0.2, 63);
  miss.record(0.3, 60);
  expect(miss.judgment(0)).toBe('miss');
});

it('allows exactly ninety percent coverage, ignores invalid frames and keeps fractional negative errors', () => {
  const notes = Array.from({ length: 10 }, (_, index) => ({
    pitch: 60,
    start: index,
    end: index + 1,
  }));
  const score = new PracticeScore(notes);
  score.record(Number.NaN, 60);
  score.record(0.1, Number.NaN);
  expect(score.summary().coverage).toBe(0);
  for (let index = 0; index < 9; index += 1) score.record(index + 0.5, 47.5);
  expect(score.summary()).toMatchObject({
    coverage: 0.9,
    accuracy: 1,
    submittable: true,
  });
  expect(
    score.summary({ difficulty: 'HARD', octaveMode: 'ANY' }).accuracy,
  ).toBe(0);
});
