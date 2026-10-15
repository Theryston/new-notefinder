import { describe, expect, it } from 'vitest';

import { PitchTracker } from './pitch-tracker';
import { syntheticTone } from './synthetic-tone';

const tone = (frequency: number, harmonics: number[] = [], amplitude = 0.5) =>
  syntheticTone({
    frequency,
    harmonics,
    amplitude,
    sampleRate: 16_000,
    length: 1024,
  });
const evidence = (frequency: number, time: number, frame: Float32Array) => ({
  candidates: [{ frequency, confidence: 0.9 }],
  periodic: { frequency, confidence: 0.99 },
  time,
  frame,
  silent: false,
});

describe('PitchTracker waveform evidence', () => {
  it('does not follow a sustained harmonic error shared by both estimators', () => {
    const tracker = new PitchTracker();
    expect(tracker.push(evidence(220, 0, tone(220)))).toBeCloseTo(57);
    const frame = tone(220, [33, 1, 8, 0.66], 0.006);
    for (let index = 1; index <= 10; index += 1) {
      expect(tracker.push(evidence(440, index * 0.032, frame))).toBeCloseTo(57);
    }
  });

  it('accepts a real octave change when the old root disappears', () => {
    const tracker = new PitchTracker();
    tracker.push(evidence(220, 0, tone(220)));
    for (let index = 1; index <= 4; index += 1) {
      tracker.push(evidence(440, index * 0.032, tone(440)));
    }
    expect(tracker.push(evidence(440, 0.16, tone(440)))).toBeCloseTo(69);
    for (let index = 1; index <= 4; index += 1) {
      tracker.push(evidence(220, 0.16 + index * 0.032, tone(220)));
    }
    expect(tracker.push(evidence(220, 0.32, tone(220)))).toBeCloseTo(57);
  });
});
