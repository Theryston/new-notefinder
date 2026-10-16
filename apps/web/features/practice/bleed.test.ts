import { describe, expect, it } from 'vitest';

import { type BleedNote, type BleedSample, suspectBleed } from './bleed';

const note: BleedNote[] = [{ start: 10, end: 20 }];

const voice = (
  from: number,
  to: number,
  midi: number | ((time: number) => number),
): BleedSample[] => {
  const samples: BleedSample[] = [];
  for (let time = from; time < to; time += 1 / 60) {
    samples.push({
      time,
      midi: typeof midi === 'function' ? midi(time) : midi,
    });
  }
  return samples;
};

describe('suspectBleed', () => {
  it('marks a steady voice held where the Track has no notes', () => {
    // A speaker leaking an A4 through two silent seconds.
    const samples = voice(0, 2, 69);

    expect(suspectBleed(samples, note)).toBe(true);
  });

  it('marks a steady leak on an instrumental Track', () => {
    expect(suspectBleed(voice(0, 2, 69), [])).toBe(true);
  });

  it('ignores a voice that only sings over the notes', () => {
    expect(suspectBleed(voice(10, 20, 69), note)).toBe(false);
  });

  it('ignores silence and unvoiced gaps', () => {
    const samples: BleedSample[] = [
      ...voice(0, 0.2, 69),
      ...Array.from({ length: 200 }, (_, index) => ({
        time: 0.2 + index / 60,
        midi: null,
      })),
    ];

    expect(suspectBleed(samples, note)).toBe(false);
  });

  it('ignores an unsteady voice wandering through the silence', () => {
    // A singer sliding up two semitones across the gap.
    const samples = voice(0, 2, (time) => 69 + time);

    expect(suspectBleed(samples, note)).toBe(false);
  });

  it('ignores a short blip, however steady', () => {
    expect(suspectBleed(voice(0, 0.2, 69), note)).toBe(false);
    expect(suspectBleed([], note)).toBe(false);
  });

  it('ignores a mostly covered voice with a steady tail', () => {
    // Nine steady seconds on the notes, one steady second past them: the
    // run is singing, not the room.
    const samples = [...voice(10, 19, 69), ...voice(20, 21, 69)];

    expect(suspectBleed(samples, note)).toBe(false);
  });
});
