import { describe, expect, it } from 'vitest';

import { frequencyToMidi, PitchSmoother } from './post-process';

const sure = (frequency: number) => ({ frequency, confidence: 0.95 });
const A4 = 440;
const A5 = 880;

describe('frequencyToMidi', () => {
  it('puts 440 Hz on A4 and doubles by octaves', () => {
    expect(frequencyToMidi(440)).toBeCloseTo(69);
    expect(frequencyToMidi(880)).toBeCloseTo(81);
    expect(frequencyToMidi(220)).toBeCloseTo(57);
  });
});

describe('PitchSmoother', () => {
  it('turns a confident reading into its note', () => {
    expect(new PitchSmoother().push(sure(A4))).toBeCloseTo(69);
  });

  it('treats a doubtful reading as silence', () => {
    const smoother = new PitchSmoother();
    expect(smoother.push({ frequency: A4, confidence: 0.5 })).toBeNull();
    expect(smoother.push(null)).toBeNull();
  });

  it('accepts a reading exactly at the confidence gate', () => {
    expect(
      new PitchSmoother().push({ frequency: A4, confidence: 0.85 }),
    ).not.toBeNull();
  });

  it('smooths a one-reading blip with the median', () => {
    const smoother = new PitchSmoother();
    for (const _ of [1, 2, 3, 4]) smoother.push(sure(A4));
    // Two semitones off for one reading is not a different note.
    const out = smoother.push(sure(A4 * 2 ** (2 / 12)));
    expect(out).toBeCloseTo(69);
  });

  it('pulls a one-reading octave slip back to the singer’s octave', () => {
    const smoother = new PitchSmoother();
    for (const _ of [1, 2, 3, 4]) smoother.push(sure(A4));
    expect(smoother.push(sure(A5))).toBeCloseTo(69);
    expect(smoother.push(sure(A4))).toBeCloseTo(69);
  });

  it('pulls a slip down an octave back up too', () => {
    const smoother = new PitchSmoother();
    for (const _ of [1, 2, 3, 4]) smoother.push(sure(A5));
    expect(smoother.push(sure(A4))).toBeCloseTo(81);
  });

  it('believes a leap that lasts', () => {
    const smoother = new PitchSmoother();
    for (const _ of [1, 2, 3, 4]) smoother.push(sure(A4));
    let out: number | null = null;
    for (const _ of [1, 2, 3, 4, 5]) out = smoother.push(sure(A5));
    expect(out).toBeCloseTo(81);
  });

  it('does not call a fifth an octave slip', () => {
    const smoother = new PitchSmoother();
    for (const _ of [1, 2, 3, 4, 5]) smoother.push(sure(A4));
    const fifth = A4 * 2 ** (7 / 12);
    let out: number | null = null;
    for (const _ of [1, 2, 3, 4, 5]) out = smoother.push(sure(fifth));
    expect(out).toBeCloseTo(76);
  });

  it('forgets the last note after a few silent readings', () => {
    const smoother = new PitchSmoother();
    for (const _ of [1, 2, 3]) smoother.push(sure(A4));
    for (const _ of [1, 2, 3]) smoother.push(null);
    // A new phrase starts fresh: no median with the old note.
    expect(smoother.push(sure(A5))).toBeCloseTo(81);
  });

  it('keeps the last note through one or two dropped readings', () => {
    const smoother = new PitchSmoother();
    for (const _ of [1, 2, 3]) smoother.push(sure(A4));
    smoother.push(null);
    smoother.push(null);
    expect(smoother.push(sure(A4))).toBeCloseTo(69);
  });

  it('takes the middle of the last five readings', () => {
    const smoother = new PitchSmoother();
    const readings = [0, 1, 2, 3, 4, 5].map((n) => sure(A4 * 2 ** (n / 12)));
    let out: number | null = null;
    for (const reading of readings) out = smoother.push(reading);
    // The window holds the last five (1 to 5 semitones up): the middle is 3.
    expect(out).toBeCloseTo(69 + 3);
  });

  it('takes a looser confidence gate when asked to', () => {
    const reading = { frequency: A4, confidence: 0.6 };
    expect(new PitchSmoother().push(reading)).toBeNull();
    expect(new PitchSmoother(0.5).push(reading)).toBeCloseTo(69);
  });
});
