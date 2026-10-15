import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { DEFAULT_RATE } from '../player/player-port';

export type PlaybackStatus =
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export type PlaybackState = {
  status: PlaybackStatus;
  /**
   * The moment being played, in seconds. It changes every frame while playing,
   * so React components never select it: they subscribe to the store and write
   * to the DOM or a canvas (apps/web/CLAUDE.md, "Forms and client state").
   */
  time: number;
  duration: number;
  rate: number;
  muted: boolean;
};

export const initialPlaybackState: PlaybackState = {
  status: 'loading',
  time: 0,
  duration: 0,
  rate: DEFAULT_RATE,
  muted: false,
};

/** One page plays one Track at a time, so the store is a singleton. */
export const playbackStore = createStore<PlaybackState>(
  () => initialPlaybackState,
);

/** Reads one slow-changing field; never pass it `time`. */
export function usePlaybackState<T>(selector: (state: PlaybackState) => T): T {
  return useStore(playbackStore, selector);
}
