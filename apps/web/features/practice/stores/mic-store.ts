import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import type { MicProblem } from '../mic-problem';

/** What the dock tells the user about the mic: a tip, or why it didn't start. */
type MicNotice = 'headphones' | MicProblem;

export type MicState = {
  /** `on` means sing mode: the timeline is labeled lanes and the voice line. */
  status: 'off' | 'starting' | 'on';
  notice: MicNotice | null;
};

export const initialMicState: MicState = { status: 'off', notice: null };

/** One page, one mic. */
export const micStore = createStore<MicState>(() => initialMicState);

export function useMicState<T>(selector: (state: MicState) => T): T {
  return useStore(micStore, selector);
}
