import { useMemo } from 'react';
import { calibratedVoice } from '../calibrated-voice';
import { useMicState } from '../stores/mic-store';

/**
 * The user's voice for the timeline while the mic is on, and nothing while it
 * is off: handing it to the timeline is what switches it to sing mode.
 */
export function useSingVoice(playback: { getState(): { rate?: number } }) {
  const voice = useMemo(
    () => calibratedVoice(() => playback.getState().rate ?? 1),
    [playback],
  );
  const micOn = useMicState((state) => state.status === 'on');
  return micOn ? voice : undefined;
}
