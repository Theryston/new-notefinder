import { pitchOfFrequency } from './note-detection-output.js';

describe('pitchOfFrequency', () => {
  it('puts A4 (440 Hz) at MIDI 69', () => {
    expect(pitchOfFrequency(440)).toBe(69);
  });

  it('moves twelve keys per octave', () => {
    expect(pitchOfFrequency(880)).toBeCloseTo(81, 10);
    expect(pitchOfFrequency(220)).toBeCloseTo(57, 10);
  });

  it('keeps the fraction of a frequency between two keys', () => {
    expect(pitchOfFrequency(466.16)).toBeCloseTo(70, 3);
    expect(pitchOfFrequency(453)).toBeCloseTo(69.5, 1);
  });
});
