import { describe, expect, it } from 'vitest';

import { PitchTracker } from './pitch-tracker';
import type { PitchReading } from './yin';

const reading = (midi: number, confidence = 0.9): PitchReading => ({
  frequency: 440 * 2 ** ((midi - 69) / 12),
  confidence,
});

function feed(
  tracker: PitchTracker,
  midi: number | null,
  time: number,
  periodic: PitchReading | null = null,
) {
  return tracker.push({
    candidates: midi === null ? [] : [reading(midi)],
    periodic,
    time,
    silent: false,
  });
}

describe('PitchTracker', () => {
  it('accepts a confident model note without periodic support', () => {
    expect(feed(new PitchTracker(), 69, 0)).toBeCloseTo(69);
  });

  it('requires stronger evidence to acquire a note than to follow one', () => {
    const tracker = new PitchTracker();
    const frames = [
      { time: 0, confidence: 0.6 },
      { time: 0.032, confidence: 0.8 },
    ];
    for (const { time, confidence } of frames) {
      const midi = tracker.push({
        candidates: [reading(57, confidence)],
        periodic: null,
        time,
        silent: false,
      });
      if (time === 0) expect(midi).toBeNull();
      else expect(midi).toBeCloseTo(57);
    }
  });

  it('preserves fractional slides and vibrato without a median staircase', () => {
    const tracker = new PitchTracker();
    const contour = [57, 57.18, 57.41, 57.69, 57.46, 57.21, 57.5];
    const result = contour.map((midi, index) =>
      feed(tracker, midi, index * 0.032),
    );
    result.forEach((midi, index) => {
      expect(midi).toBeCloseTo(contour[index] ?? 0);
    });
  });

  it('follows an accelerating slide through a temporary confidence dip', () => {
    const tracker = new PitchTracker();
    const contour = [48, 49, 51.4, 55, 56.2, 55.9];
    const confidence = [0.8, 0.6, 0.45, 0.42, 0.8, 0.8];
    contour.forEach((midi, index) => {
      const output = tracker.push({
        candidates: [reading(midi, confidence[index])],
        periodic: null,
        time: index * 0.032,
        silent: false,
      });
      expect(output).toBeCloseTo(midi);
    });
  });

  it('does not turn a weak isolated candidate into a new note', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    expect(
      tracker.push({
        candidates: [reading(69, 0.4)],
        periodic: null,
        time: 0.032,
        silent: false,
      }),
    ).toBeCloseTo(57);
    expect(
      tracker.push({
        candidates: [reading(69, 0.4)],
        periodic: null,
        time: 0.16,
        silent: false,
      }),
    ).toBeNull();
  });

  it.each([45, 64, 69])(
    'rejects an isolated jump from A3 to MIDI %s',
    (midi) => {
      const tracker = new PitchTracker();
      feed(tracker, 57, 0);
      expect(feed(tracker, midi, 0.032)).toBeCloseTo(57);
      expect(feed(tracker, 57.1, 0.064)).toBeCloseTo(57.1);
    },
  );

  it.each([45, 64, 69])('accepts a persistent real leap to MIDI %s', (midi) => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    for (const time of [0.032, 0.064, 0.096]) feed(tracker, midi, time);
    expect(feed(tracker, midi + 0.15, 0.128)).toBeCloseTo(midi + 0.15);
  });

  it('does not accumulate opposite octave outliers as one target', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    const notes = [69, 45, 69, 45, 69];
    const outputs = notes.map((midi, index) =>
      feed(tracker, midi, (index + 1) * 0.032),
    );
    expect(
      outputs.every((midi) => midi === null || Math.abs(midi - 57) < 0.01),
    ).toBe(true);
  });

  it('missing evidence resets confirmation without forgetting the reference', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    feed(tracker, 69, 0.032);
    feed(tracker, 69, 0.064);
    expect(feed(tracker, null, 0.096)).toBeNull();
    expect(feed(tracker, 69, 0.128)).toBeNull();
    expect(feed(tracker, 69, 0.16)).toBeNull();
    expect(feed(tracker, 57, 0.192)).toBeCloseTo(57);
  });

  it('bridges only a bounded uncertain gap when sound is still present', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    expect(feed(tracker, null, 0.032)).toBeCloseTo(57);
    expect(feed(tracker, null, 0.064)).toBeCloseTo(57);
    expect(feed(tracker, null, 0.096)).toBeNull();
    expect(feed(tracker, 69, 0.128)).toBeNull();
    expect(feed(tracker, 57, 0.16)).toBeCloseTo(57);
  });

  it('does not reacquire a weak nearby candidate after the hold has expired', () => {
    const tracker = new PitchTracker();
    feed(tracker, 60, 0);
    for (const time of [0.032, 0.064, 0.096]) feed(tracker, null, time);
    expect(
      tracker.push({
        candidates: [reading(60.1, 0.33)],
        periodic: null,
        time: 0.128,
        silent: false,
      }),
    ).toBeNull();
    expect(feed(tracker, null, 0.16)).toBeNull();
  });

  it('resumes a corroborated phrase through a modest glide after uncertainty', () => {
    const tracker = new PitchTracker();
    feed(tracker, 60, 0);
    for (const time of [0.032, 0.064, 0.096]) feed(tracker, null, time);
    expect(feed(tracker, 55, 0.128)).toBeNull();
    for (const [index, midi] of [55.2, 55.6, 56.1].entries()) {
      expect(
        feed(tracker, midi, 0.16 + index * 0.032, reading(midi + 0.1, 0.95)),
      ).toBeCloseTo(midi);
    }
  });

  it('confirms a drifting new target from consecutive compatible readings', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    for (const [index, midi] of [69, 69.4, 69.8].entries()) {
      feed(tracker, midi, (index + 1) * 0.032);
    }
    expect(feed(tracker, 70.2, 0.128)).toBeCloseTo(70.2);
  });

  it('never fills measured silence and reacquires after a real pause', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    for (const time of [0.032, 0.32]) {
      expect(
        tracker.push({
          candidates: [reading(57)],
          periodic: null,
          time,
          silent: true,
        }),
      ).toBeNull();
    }
    expect(feed(tracker, 69, 0.352)).toBeCloseTo(69);
  });

  it('forgets a prolonged uncertain gap, without holding it as sung', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    expect(feed(tracker, null, 0.32)).toBeNull();
    expect(feed(tracker, 69, 0.352)).toBeCloseTo(69);
  });

  it('uses elapsed capture time rather than the number of callbacks', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    for (let index = 1; index <= 50; index += 1) {
      expect(feed(tracker, 69, index / 1000)).toBeCloseTo(57);
    }
    expect(feed(tracker, 69, 0.09)).toBeCloseTo(69);
  });

  it('does not interpret missing capture frames as continuous confirmation', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 0);
    expect(feed(tracker, 69, 0.032)).toBeCloseTo(57);
    expect(feed(tracker, 69, 0.16)).toBeNull();
    expect(feed(tracker, 69, 0.192)).toBeNull();
    expect(feed(tracker, 57, 0.224)).toBeCloseTo(57);
  });

  it('ignores duplicate, stale and invalid capture timestamps', () => {
    const tracker = new PitchTracker();
    feed(tracker, 57, 1);
    for (const time of [1, 0.9, Number.NaN, Infinity]) {
      expect(feed(tracker, 69, time)).toBeNull();
    }
    expect(feed(tracker, 57, 1.032)).toBeCloseTo(57);
  });

  it('rescues a diffuse model peak when periodic evidence agrees', () => {
    const tracker = new PitchTracker();
    expect(
      tracker.push({
        candidates: [reading(69, 0.8), reading(57.1, 0.2)],
        periodic: reading(57, 0.98),
        time: 0,
        silent: false,
      }),
    ).toBeCloseTo(57.1);
  });

  it('rescues a weak model with reliable periodic evidence alone', () => {
    const tracker = new PitchTracker();
    expect(
      tracker.push({
        candidates: [reading(69, 0.1)],
        periodic: reading(57, 0.98),
        time: 0,
        silent: false,
      }),
    ).toBeCloseTo(57);
  });

  it('does not allow a doubtful periodic reading to overrule the model', () => {
    expect(feed(new PitchTracker(), 69, 0, reading(57, 0.8))).toBeCloseTo(69);
  });

  it('does not invent a note when both detectors are uncertain', () => {
    expect(
      new PitchTracker().push({
        candidates: [reading(69, 0.2)],
        periodic: reading(57, 0.8),
        time: 0,
        silent: false,
      }),
    ).toBeNull();
  });

  it('ignores invalid frequencies and confidences', () => {
    const candidates = [
      { frequency: 0, confidence: 0.9 },
      { frequency: Infinity, confidence: 0.9 },
      { frequency: 220, confidence: Number.NaN },
      { frequency: 220, confidence: -1 },
      { frequency: 220, confidence: 2 },
    ];
    expect(
      new PitchTracker().push({
        candidates,
        periodic: null,
        time: 0,
        silent: false,
      }),
    ).toBeNull();
  });
});
