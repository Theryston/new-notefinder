import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { clampTranspose } from '../transpose/transpose';

type TransposeState = { semitones: number };

/**
 * The transposition of the Track on screen, in semitones. It is a store of its
 * own, not part of the playback store, because starting a playback resets that
 * one and a transposition outlives the player. One page shows one Track.
 */
export const transposeStore = createStore<TransposeState>(() => ({
  semitones: 0,
}));

export function setTranspose(semitones: number): void {
  transposeStore.setState({ semitones: clampTranspose(semitones) });
}

export function useTranspose(): number {
  return useStore(transposeStore, (state) => state.semitones);
}
