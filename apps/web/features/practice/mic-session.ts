import { latencyCompensation } from './latency';
import { loadCrepeModel } from './pitch/crepe-model';
import { createPitchEngine } from './pitch/pitch-engine';

/** The audio thread's capture module; the bundler serves it as a file. */
const WORKLET_URL = new URL('./pitch/capture-worklet.js', import.meta.url);

/**
 * Echo cancellation and noise suppression keep the music out of the reading;
 * automatic gain stays off because it pumps the level and breaks the silence
 * gate.
 */
const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
  },
};

function debugLog(message: string): void {
  // biome-ignore lint/suspicious/noConsole: which engine runs is meant to show in debug logs only.
  console.debug(`[pitch] ${message}`);
}

export type MicSession = { stop: () => void };

/** Gets a reading and how long before "now" on the Track it was sung. */
export type OnReading = (midi: number | null, lagSeconds: number) => void;

/**
 * Opens the mic and reports the sung note as it changes. Pitch is found by
 * the CREPE model with the classic YIN detector as fallback
 * ({@link createPitchEngine}); the model and its runtime load here, so only
 * when the mic is turned on.
 */
export async function startMicSession(
  onReading: OnReading,
): Promise<MicSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not available');
  }
  const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  const context = new AudioContext({ latencyHint: 'interactive' });
  try {
    await context.audioWorklet.addModule(WORKLET_URL);
    await context.resume();
  } catch (error) {
    for (const track of stream.getTracks()) track.stop();
    await context.close();
    throw error;
  }
  // `latency` is in the spec's track settings but not yet in TypeScript's DOM types.
  const settings: (MediaTrackSettings & { latency?: number }) | undefined =
    stream.getAudioTracks()[0]?.getSettings();
  const inputLatency = settings?.latency;
  const node = new AudioWorkletNode(context, 'pitch-capture');
  const engine = createPitchEngine({
    sampleRate: context.sampleRate,
    loadModel: loadCrepeModel,
    onReading: (midi, windowSeconds) =>
      onReading(
        midi,
        latencyCompensation(
          {
            baseLatency: context.baseLatency,
            outputLatency: context.outputLatency,
            inputLatency,
          },
          windowSeconds,
        ),
      ),
    log: debugLog,
  });
  node.port.onmessage = (event: MessageEvent<Float32Array>) =>
    engine.feed(event.data);
  context.createMediaStreamSource(stream).connect(node);

  return {
    stop: () => {
      engine.stop();
      node.port.onmessage = null;
      node.disconnect();
      for (const track of stream.getTracks()) track.stop();
      void context.close();
    },
  };
}
