import { describe, expect, it } from 'vitest';

import { bestScoreAt } from './best-score';

describe('bestScoreAt', () => {
  const scores = { EASY: 0.9, NORMAL: null, HARD: 0.5 };

  it('picks the difficulty on screen', () => {
    expect(bestScoreAt(scores, 'EASY')).toBe(0.9);
    expect(bestScoreAt(scores, 'HARD')).toBe(0.5);
  });

  it('is null where nothing was saved, or nothing is known', () => {
    expect(bestScoreAt(scores, 'NORMAL')).toBeNull();
    expect(bestScoreAt(undefined, 'NORMAL')).toBeNull();
  });
});
