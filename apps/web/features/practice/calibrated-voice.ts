import { shiftedVoiceTime } from './calibration-math';
import { singingAidsStore } from './stores/singing-aids-store';
import { voiceTrail } from './voice-trail';

/** A presentation adapter: the detector's readings and raw trail stay intact. */
export function calibratedVoice(rate: () => number) {
  return {
    segments(from: number, to: number) {
      const offset = singingAidsStore.getState().offset;
      const shift = offset * rate();
      return voiceTrail.segments(from + shift, to + shift).map((segment) =>
        segment.map((point) => ({
          ...point,
          time: shiftedVoiceTime(point.time, offset, rate()),
        })),
      );
    },
    subscribe(listener: () => void) {
      const stopVoice = voiceTrail.subscribe(listener);
      const stopOffset = singingAidsStore.subscribe(listener);
      return () => {
        stopVoice();
        stopOffset();
      };
    },
  };
}
