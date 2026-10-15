import { PitchSmoother } from './post-process';
import { detectPitchYin } from './yin';

/** Samples the detector looks at, and how many new ones make a new reading. */
export const WINDOW_SIZE = 2048;
export const HOP_SIZE = 512;

/** One reading: the smoothed note, or null where nothing is voiced. */
export type VoiceReading = { midi: number | null };

/**
 * The classic detector end to end: mic blocks go in, a smoothed reading comes
 * out for every {@link HOP_SIZE} new samples, over a sliding window of
 * {@link WINDOW_SIZE}. It needs no browser API, so it runs the same in tests.
 */
export class PitchPipeline {
  private readonly window = new Float32Array(WINDOW_SIZE);
  private readonly smoother = new PitchSmoother();
  private sinceReading = 0;

  constructor(private readonly sampleRate: number) {}

  /** The seconds of audio one reading looks at. */
  get windowSeconds(): number {
    return WINDOW_SIZE / this.sampleRate;
  }

  /** Feeds a block of samples; returns a reading for each hop it completes. */
  feed(block: Float32Array): VoiceReading[] {
    const readings: VoiceReading[] = [];
    let offset = 0;
    while (offset < block.length) {
      const take = Math.min(
        HOP_SIZE - this.sinceReading,
        block.length - offset,
      );
      this.append(block.subarray(offset, offset + take));
      offset += take;
      this.sinceReading += take;
      if (this.sinceReading === HOP_SIZE) {
        this.sinceReading = 0;
        readings.push({
          midi: this.smoother.push(
            detectPitchYin(this.window, this.sampleRate),
          ),
        });
      }
    }
    return readings;
  }

  private append(samples: Float32Array): void {
    this.window.copyWithin(0, samples.length);
    this.window.set(samples, WINDOW_SIZE - samples.length);
  }
}
