import type { StoreApi } from 'zustand';

import type { PlayerPort } from '../player/player-port';
import {
  initialPlaybackState,
  type PlaybackState,
} from '../stores/playback-store';
import { type FrameScheduler, PlaybackController } from './playback-controller';

export type StartPlaybackOptions = {
  /** The element the video mounts into. */
  host: HTMLElement;
  videoId: string;
  fake: boolean;
  /** The Track's length until the player knows it. */
  durationHint: number;
  store: StoreApi<PlaybackState>;
  frames: FrameScheduler;
  /** Makes the player; a dynamic import in the app, a stub in tests. */
  makePlayer: (options: {
    host: HTMLElement;
    durationSeconds: number;
    fake: boolean;
  }) => Promise<PlayerPort>;
  /** Told when the controller exists, and (null) when it is gone. */
  onController: (controller: PlaybackController | null) => void;
};

export type PlaybackSession = {
  /** The Track's length changed (the notes arrived); never rebuilds the player. */
  setDurationHint: (seconds: number) => void;
  /** Stops everything and removes the player. */
  dispose: () => void;
};

/**
 * Creates the player for a video and the controller that drives it, and gives
 * back the way to stop them. A player that is still being created when the
 * session is disposed is destroyed as soon as it arrives. When the player
 * cannot be created (the IFrame API blocked, offline) or never loads, the
 * store says `error` so the dock shows it instead of loading forever.
 */
export function startPlayback(options: StartPlaybackOptions): PlaybackSession {
  const { host, videoId, fake, store, frames, makePlayer, onController } =
    options;
  let hint = options.durationHint;
  let controller: PlaybackController | null = null;
  let cancelled = false;
  store.setState({
    ...initialPlaybackState,
    transpose: store.getState().transpose,
  });

  makePlayer({ host, durationSeconds: hint, fake })
    .then((player) => {
      if (cancelled) {
        player.destroy();
        return;
      }
      controller = new PlaybackController({
        port: player,
        store,
        frames,
        durationHint: hint,
      });
      onController(controller);
      return player.load(videoId);
    })
    .catch(() => {
      if (!cancelled) store.setState({ status: 'error' });
    });

  return {
    setDurationHint(seconds) {
      hint = seconds;
      controller?.setDurationHint(seconds);
    },
    dispose() {
      cancelled = true;
      controller?.dispose();
      controller = null;
      onController(null);
    },
  };
}
