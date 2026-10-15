import { describe, expect, it } from 'vitest';

import { PitchSmoother } from './post-process';

describe('PitchSmoother octave transitions', () => {
  it.each([
    { direction: 'up', fromHz: 220, toHz: 440, fromMidi: 57, toMidi: 69 },
    { direction: 'down', fromHz: 440, toHz: 220, fromMidi: 69, toMidi: 57 },
  ])(
    'keeps every reading valid when accepting an octave $direction',
    ({ fromHz, toHz, fromMidi, toMidi }) => {
      const smoother = new PitchSmoother();
      for (let i = 0; i < 5; i += 1) {
        smoother.push({ frequency: fromHz, confidence: 0.95 });
      }

      const readings = Array.from({ length: 4 }, () =>
        smoother.push({ frequency: toHz, confidence: 0.95 }),
      );

      expect(readings).toEqual([fromMidi, fromMidi, toMidi, toMidi]);
    },
  );
});
