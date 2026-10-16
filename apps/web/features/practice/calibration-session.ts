import { calibrationOffset } from './calibration-math';
import { watchCalibrationReading } from './calibration-reading';
import { createSingingSynth } from './singing-synth';

type Options = {
  onBeat: (remaining: number) => void;
  onDone: (offset: number | null) => void;
  onError: () => void;
};

/** Ten alternating beeps. The first matching transition is one sung response. */
export function startCalibration(options: Options): () => void {
  let cancelled = false;
  let stop: () => void = () => {};
  void createSingingSynth()
    .then((synth) => {
      if (cancelled) {
        synth.dispose();
        return;
      }
      const samples: number[] = [];
      let beat = -1;
      let soundedAt = 0;
      let captured = true;
      let previous: number | null = null;
      const unwatch = watchCalibrationReading(({ midi, lagSeconds, at }) => {
        const target = beat % 2 === 0 ? 69 : 72;
        const matched = midi !== null && Math.abs(midi - target) < 0.75;
        const wasMatched =
          previous !== null && Math.abs(previous - target) < 0.75;
        if (!captured && matched && !wasMatched && at - soundedAt < 0.8) {
          samples.push(at - soundedAt - lagSeconds);
          captured = true;
        }
        previous = midi;
      });
      const next = () => {
        beat += 1;
        if (beat === 10) {
          stop();
          options.onDone(calibrationOffset(samples));
          return;
        }
        soundedAt = performance.now() / 1000;
        captured = false;
        synth.play(beat % 2 === 0 ? 69 : 72, 0.25);
        options.onBeat(10 - beat);
      };
      const timer = setInterval(next, 1000);
      stop = () => {
        clearInterval(timer);
        unwatch();
        synth.dispose();
      };
      next();
    })
    .catch(() => {
      stop();
      if (!cancelled) options.onError();
    });
  return () => {
    cancelled = true;
    stop();
  };
}
