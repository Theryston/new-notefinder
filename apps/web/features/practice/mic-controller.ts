import { micProblemOf } from './mic-problem';
import type { MicSession } from './mic-session';
import { micStore } from './stores/mic-store';
import { voiceTrail } from './voice-trail';

/** The part of the page's playback the voice is placed against. */
export type PlaybackSource = {
  getState(): { status: string; time: number };
  subscribe(listener: () => void): () => void;
};

let session: MicSession | null = null;

/** Places a reading on the Track; while paused it only feeds the readout. */
function placeReading(playback: PlaybackSource) {
  return (midi: number | null, lagSeconds: number): void => {
    const { status, time } = playback.getState();
    if (status === 'playing') voiceTrail.push(time - lagSeconds, midi);
    else voiceTrail.setLatest(midi);
  };
}

/**
 * Turns the mic on. The pitch engine is a dynamic import, so just listening
 * to a Track never downloads it. A refusal is left in the store for the dock
 * to explain; it is not thrown.
 */
async function startMic(playback: PlaybackSource): Promise<void> {
  if (micStore.getState().status !== 'off') return;
  micStore.setState({ status: 'starting', problem: null });
  try {
    const { startMicSession } = await import('./mic-session');
    session = await startMicSession(placeReading(playback));
    micStore.setState({ status: 'on' });
  } catch (error) {
    micStore.setState({ status: 'off', problem: micProblemOf(error) });
  }
}

export function stopMic(): void {
  session?.stop();
  session = null;
  voiceTrail.clear();
  micStore.setState({ status: 'off' });
}

export function toggleMic(playback: PlaybackSource): Promise<void> {
  if (micStore.getState().status === 'on') {
    stopMic();
    return Promise.resolve();
  }
  return startMic(playback);
}
