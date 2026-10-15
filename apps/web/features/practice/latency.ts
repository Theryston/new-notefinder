/** What the browser reports about the audio path, in seconds. */
export type AudioLatencies = {
  /** `AudioContext.baseLatency`: the context's own processing delay. */
  baseLatency?: number;
  /** `AudioContext.outputLatency`: from the context to the speakers. */
  outputLatency?: number;
  /** The mic track's `latency` setting: from the voice to the samples. */
  inputLatency?: number;
};

const finite = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

/**
 * How far behind the music a voice reading is. The singer hears the music
 * after the output delay and their voice reaches the samples after the input
 * delay, so a reading belongs that long before the Track's current moment.
 * Half the detector window is added because a reading describes its window's
 * middle, not its end.
 */
export function latencyCompensation(
  latencies: AudioLatencies,
  windowSeconds: number,
): number {
  return (
    finite(latencies.baseLatency) +
    finite(latencies.outputLatency) +
    finite(latencies.inputLatency) +
    windowSeconds / 2
  );
}
