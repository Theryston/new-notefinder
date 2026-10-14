const A4_MIDI = 69;
const A4_HZ = 440;

/**
 * The continuous MIDI pitch (A4 is 69) of a frequency. The current worker
 * reports a note's mean frequency, and the Vocal note keeps the pitch.
 */
export const pitchOfFrequency = (hz: number): number =>
  A4_MIDI + 12 * Math.log2(hz / A4_HZ);
