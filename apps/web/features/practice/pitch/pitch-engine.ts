import { type ModelDetector, ModelPipeline } from './model-pipeline';
import { PitchPipeline } from './pitch-pipeline';

export type PitchEngine = {
  feed(block: Float32Array): void;
  stop(): void;
};

export type PitchEngineOptions = {
  sampleRate: number;
  /** Downloads and starts the ML model; rejects when it can't. */
  loadModel: () => Promise<ModelDetector>;
  /** A smoothed note (null: nothing voiced) and the seconds its window spans. */
  onReading: (midi: number | null, windowSeconds: number) => void;
  /** Debug log only: which engine runs is not something the user sees. */
  log: (message: string) => void;
};

/**
 * The pitch engine: the ML model is primary and the classic YIN detector is
 * the fallback. YIN answers from the first sample, while the model downloads;
 * once it is loaded it takes over. If it fails to load, fails while running or
 * can't keep up in real time, YIN takes back for the rest of the session.
 */
export function createPitchEngine({
  sampleRate,
  loadModel,
  onReading,
  log,
}: PitchEngineOptions): PitchEngine {
  let classic = new PitchPipeline(sampleRate);
  let model: ModelPipeline | null = null;
  let stopped = false;
  log('pitch engine: classic YIN while the model loads');

  loadModel().then(
    (detector) => {
      if (stopped) return;
      const pipeline = new ModelPipeline(sampleRate, detector, {
        onReading: (midi) => onReading(midi, pipeline.windowSeconds),
        onGiveUp: (reason) => {
          model = null;
          classic = new PitchPipeline(sampleRate);
          log(`pitch engine: model gave up (${reason}), using classic YIN`);
        },
      });
      model = pipeline;
      log('pitch engine: ML model (CREPE tiny)');
    },
    (error: unknown) => {
      log(`pitch engine: model failed to load (${String(error)}), using YIN`);
    },
  );

  return {
    feed: (block) => {
      if (model) {
        model.feed(block);
        return;
      }
      for (const reading of classic.feed(block)) {
        onReading(reading.midi, classic.windowSeconds);
      }
    },
    stop: () => {
      stopped = true;
      model = null;
    },
  };
}
