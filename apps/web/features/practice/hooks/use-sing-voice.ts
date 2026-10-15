import { useMicState } from '../stores/mic-store';
import { voiceTrail } from '../voice-trail';

/**
 * The user's voice for the timeline while the mic is on, and nothing while it
 * is off: handing it to the timeline is what switches it to sing mode.
 */
export function useSingVoice() {
  const micOn = useMicState((state) => state.status === 'on');
  return micOn ? voiceTrail : undefined;
}
