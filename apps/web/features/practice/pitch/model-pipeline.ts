import {
  CREPE_FRAME,
  CREPE_RATE,
  decodeActivation,
  normalizeFrame,
} from './crepe';
import { Downsampler } from './downsampler';
import { PitchSmoother } from './post-process';
import { isSilent, type PitchReading } from './yin';

/** What the ML engine needs from a model runtime: one frame in, one pitch out. */
export type ModelDetector = {
  /** Runs the model on a normalized 1024-sample, 16 kHz frame. */
  detect(frame: Float32Array): Promise<ArrayLike<number>>;
};

/** New samples (at the model's rate) between two readings: 32 ms. */
const HOP = 512;

/** The model is more spread than YIN, so its confidence gate is lower. */
const MODEL_MIN_CONFIDENCE = 0.5;

/**
 * Frames in a row that arrive while the model is still busy with the last one
 * before it is called too slow for real time (8 hops is a quarter second).
 */
export const MAX_DROPPED_FRAMES = 8;

export type ModelPipelineEvents = {
  onReading(midi: number | null): void;
  /** The model can't be used any more: it failed or can't keep up. */
  onGiveUp(reason: 'failed' | 'too-slow'): void;
};

/**
 * The ML engine end to end: mic blocks go in, a smoothed reading comes out
 * per hop. Inference is asynchronous; a frame that arrives while the previous
 * one is still running is dropped, and too many drops in a row mean the device
 * can't keep up.
 */
export class ModelPipeline {
  readonly windowSeconds = CREPE_FRAME / CREPE_RATE;
  private readonly downsampler: Downsampler;
  private readonly window = new Float32Array(CREPE_FRAME);
  private readonly smoother = new PitchSmoother(MODEL_MIN_CONFIDENCE);
  private sinceReading = 0;
  private busy = false;
  private dropped = 0;
  private done = false;

  constructor(
    sampleRate: number,
    private readonly detector: ModelDetector,
    private readonly events: ModelPipelineEvents,
  ) {
    this.downsampler = new Downsampler(sampleRate, CREPE_RATE);
  }

  feed(block: Float32Array): void {
    if (this.done) return;
    const samples = this.downsampler.push(block);
    if (samples.length === 0) return;
    // A block is far smaller than the window; keep only the newest samples.
    const keep = samples.subarray(Math.max(0, samples.length - CREPE_FRAME));
    this.window.copyWithin(0, keep.length);
    this.window.set(keep, CREPE_FRAME - keep.length);
    this.sinceReading += samples.length;
    if (this.sinceReading >= HOP) {
      this.sinceReading = 0;
      this.read();
    }
  }

  private read(): void {
    if (this.busy) {
      this.dropped += 1;
      if (this.dropped >= MAX_DROPPED_FRAMES) this.giveUp('too-slow');
      return;
    }
    this.dropped = 0;
    const frame = this.window.slice();
    if (isSilent(frame)) {
      this.events.onReading(this.smoother.push(null));
      return;
    }
    this.busy = true;
    this.detector.detect(normalizeFrame(frame)).then(
      (activation) => {
        this.busy = false;
        if (this.done) return;
        const reading: PitchReading | null = decodeActivation(activation);
        this.events.onReading(this.smoother.push(reading));
      },
      () => {
        this.busy = false;
        this.giveUp('failed');
      },
    );
  }

  private giveUp(reason: 'failed' | 'too-slow'): void {
    if (this.done) return;
    this.done = true;
    this.events.onGiveUp(reason);
  }
}
