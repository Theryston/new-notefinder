import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type { MicProblem } from '../mic-problem';

export type MicState = {
  /** `on` means sing mode: the timeline is labeled lanes and the voice line. */
  status: 'off' | 'starting' | 'on';
  /** Why the last attempt to turn the mic on failed, until the next attempt. */
  problem: MicProblem | null;
};

export const initialMicState: MicState = { status: 'off', problem: null };

/** One page, one mic. */
export const micStore = createStore<MicState>(() => initialMicState);

export function useMicState<T>(selector: (state: MicState) => T): T {
  return useStore(micStore, selector);
}
