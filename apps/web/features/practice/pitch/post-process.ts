import type { PitchReading } from './yin';

/** The MIDI number (fractional) of a frequency; 440 Hz is A4, which is 69. */
export function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

/** Readings less sure than this are treated as not singing. */
const DEFAULT_MIN_CONFIDENCE = 0.85;

/** How many voiced readings the median looks at. */
const MEDIAN_SIZE = 5;

/** A jump this big in one reading, to an octave away, is a detector slip. */
const OCTAVE_JUMP_MIN = 9;
const OCTAVE_TOLERANCE = 2;

/** Readings in a row at the new octave before it is believed (a real leap). */
const OCTAVE_ACCEPT_RUN = 3;

/** Unvoiced readings in a row before the smoothing forgets the last note. */
const FORGET_AFTER = 3;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Turns raw detector readings into a steady voice: low-confidence readings
 * count as silence (a gap), one-reading octave slips are pulled back to the
 * octave the singer was in, and a median over the last few readings removes
 * the remaining jitter. Feed it one reading per detector frame.
 */
export class PitchSmoother {
  private history: number[] = [];
  private unvoiced = 0;
  private jumpRun = 0;

  constructor(private readonly minConfidence = DEFAULT_MIN_CONFIDENCE) {}

  /** The smoothed MIDI number (fractional), or null where nothing is voiced. */
  push(reading: PitchReading | null): number | null {
    if (!reading || reading.confidence < this.minConfidence) {
      this.unvoiced += 1;
      if (this.unvoiced >= FORGET_AFTER) this.history = [];
      return null;
    }
    this.unvoiced = 0;
    this.history.push(this.settleOctave(frequencyToMidi(reading.frequency)));
    if (this.history.length > MEDIAN_SIZE) this.history.shift();
    return median(this.history);
  }

  private settleOctave(midi: number): number {
    const last = this.history.at(-1);
    if (last === undefined) return midi;
    const octaves = Math.round((midi - last) / 12);
    const isSlip =
      octaves !== 0 &&
      Math.abs(midi - last) > OCTAVE_JUMP_MIN &&
      Math.abs(midi - octaves * 12 - last) < OCTAVE_TOLERANCE;
    if (!isSlip) {
      this.jumpRun = 0;
      return midi;
    }
    this.jumpRun += 1;
    if (this.jumpRun >= OCTAVE_ACCEPT_RUN) {
      this.history = [];
      this.jumpRun = 0;
      return midi;
    }
    return midi - octaves * 12;
  }
}
