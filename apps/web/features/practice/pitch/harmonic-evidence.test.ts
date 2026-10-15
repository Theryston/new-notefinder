import { describe, expect, it } from 'vitest';

import { resolveOctave } from './harmonic-evidence';
import { frequencyToMidi } from './post-process';
import { syntheticTone } from './synthetic-tone';

describe('octave evidence in the captured waveform', () => {
  it('retains a weak fundamental beneath a dominant second harmonic', () => {
    const frame = syntheticTone({
      frequency: 138.591,
      sampleRate: 16_000,
      length: 1024,
      amplitude: 0.006,
      harmonics: [33, 1, 8, 0.66],
    });
    const root = frequencyToMidi(138.591);
    expect(resolveOctave(frame, root, root + 12)).toBeCloseTo(root);
  });

  it.each([110, 220])('accepts a real octave leap from %i Hz', (frequency) => {
    const frame = syntheticTone({
      frequency: frequency * 2,
      sampleRate: 16_000,
      length: 1024,
      harmonics: [0.5, 0.3],
    });
    expect(
      resolveOctave(
        frame,
        frequencyToMidi(frequency),
        frequencyToMidi(frequency * 2),
      ),
    ).toBeCloseTo(frequencyToMidi(frequency * 2));
  });

  it('does not invent a subharmonic when the actual root is an octave higher', () => {
    const frame = syntheticTone({
      frequency: 440,
      sampleRate: 16_000,
      length: 1024,
    });
    expect(resolveOctave(frame, 69, 57)).toBeCloseTo(69);
  });

  it('accepts a real downward octave with its own fundamental', () => {
    const frame = syntheticTone({
      frequency: 220,
      sampleRate: 16_000,
      length: 1024,
    });
    expect(resolveOctave(frame, 69, 57)).toBeCloseTo(57);
  });

  it('does not resolve noise or unrelated intervals as octave evidence', () => {
    expect(resolveOctave(new Float32Array(1024), 57, 69)).toBeNull();
    expect(resolveOctave(new Float32Array(1024), 57, 64)).toBeNull();
  });
});
