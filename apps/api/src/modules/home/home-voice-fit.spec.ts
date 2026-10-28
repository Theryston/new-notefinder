import type { TrackVocalRange } from '@vozzify/contracts';
import {
  challengeOverrun,
  MAX_CHALLENGE_OVERRUN_SEMITONES,
  MAX_VOICE_TRANSPOSITION_SEMITONES,
  MIN_CHALLENGE_OVERRUN_SEMITONES,
  voiceFitScore,
  voiceTransposeSemitones,
} from './home-voice-fit.js';

const userRange: TrackVocalRange = { lowest: 60, highest: 72 };

describe('voiceTransposeSemitones', () => {
  it('returns zero when the Track range fits without transposing', () => {
    expect(
      voiceTransposeSemitones(userRange, { lowest: 62, highest: 70 }),
    ).toBe(0);
  });

  it('returns the smallest shift that brings the range inside the User range', () => {
    expect(
      voiceTransposeSemitones(userRange, { lowest: 59, highest: 69 }),
    ).toBe(1);
    expect(
      voiceTransposeSemitones(userRange, { lowest: 63, highest: 73 }),
    ).toBe(-1);
  });

  it('returns null when the Track is wider than the User range', () => {
    expect(
      voiceTransposeSemitones(userRange, { lowest: 55, highest: 73 }),
    ).toBeNull();
  });
});

describe('voiceFitScore', () => {
  it('scores no transposition above a small transposition', () => {
    const exact = voiceFitScore(userRange, { lowest: 60, highest: 70 });
    const shifted = voiceFitScore(userRange, { lowest: 59, highest: 69 });

    expect(exact).toBeGreaterThan(shifted);
  });

  it('penalizes each extra semitone and rejects shifts beyond the threshold', () => {
    const oneSemitone = voiceFitScore(userRange, { lowest: 59, highest: 69 });
    const twoSemitones = voiceFitScore(userRange, { lowest: 58, highest: 68 });
    const tooFar = voiceFitScore(userRange, { lowest: 56, highest: 66 });

    expect(oneSemitone).toBeGreaterThan(twoSemitones);
    expect(twoSemitones).toBeGreaterThan(tooFar);
    expect(tooFar).toBe(0);
    expect(MAX_VOICE_TRANSPOSITION_SEMITONES).toBeGreaterThan(0);
  });
});

describe('challengeOverrun', () => {
  it('accepts an overrun at either edge from one to three semitones', () => {
    expect(challengeOverrun(userRange, { lowest: 58, highest: 65 })).toBe(2);
    expect(challengeOverrun(userRange, { lowest: 68, highest: 74 })).toBe(2);
    expect(challengeOverrun(userRange, { lowest: 59, highest: 73 })).toBe(1);
    expect(challengeOverrun(userRange, { lowest: 60, highest: 73 })).toBe(1);
    expect(challengeOverrun(userRange, { lowest: 59, highest: 72 })).toBe(1);
    expect(MIN_CHALLENGE_OVERRUN_SEMITONES).toBe(1);
    expect(MAX_CHALLENGE_OVERRUN_SEMITONES).toBe(3);
  });

  it('rejects ranges inside, too far outside, or beyond both edges', () => {
    expect(challengeOverrun(userRange, { lowest: 62, highest: 70 })).toBeNull();
    expect(challengeOverrun(userRange, { lowest: 60, highest: 76 })).toBeNull();
    expect(challengeOverrun(userRange, { lowest: 56, highest: 76 })).toBeNull();
    expect(
      challengeOverrun(userRange, { lowest: 73, highest: 100 }),
    ).toBeNull();
    expect(challengeOverrun(userRange, { lowest: 32, highest: 59 })).toBeNull();
  });
});
