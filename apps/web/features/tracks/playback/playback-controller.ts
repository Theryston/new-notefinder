import type { StoreApi } from 'zustand';

import type { PlayerPort, PlayerState } from '../player/player-port';
import {
  initialPlaybackState,
  type PlaybackState,
} from '../stores/playback-store';
import { clampTime, SKIP_SECONDS } from './playback-math';

export type FrameScheduler = {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
};

export type PlaybackControllerOptions = {
  port: PlayerPort;
  store: StoreApi<PlaybackState>;
  frames: FrameScheduler;
  /** The Track's length from its header, until the player knows it. */
  durationHint: number;
};

const STATUS_OF: Record<PlayerState, PlaybackState['status']> = {
  ready: 'ready',
  playing: 'playing',
  paused: 'paused',
  ended: 'ended',
};

/**
 * Drives a player and mirrors it into the playback store. While the music
 * plays it reads the player's time once per frame into the store, where the
 * timeline and the progress track pick it up by subscription; nothing here
 * renders React. Its methods are arrow properties so they can be handed to
 * event handlers as they are.
 */
export class PlaybackController {
  private readonly port: PlayerPort;
  private readonly store: StoreApi<PlaybackState>;
  private readonly frames: FrameScheduler;
  private frame: number | null = null;
  private readonly stopListening: () => void;

  constructor({
    port,
    store,
    frames,
    durationHint,
  }: PlaybackControllerOptions) {
    this.port = port;
    this.store = store;
    this.frames = frames;
    store.setState({ ...initialPlaybackState, duration: durationHint });
    this.stopListening = port.onState(this.onPlayerState);
  }

  play = (): void => {
    const { status, videoHidden } = this.store.getState();
    if (status === 'loading') return;
    if (videoHidden) this.store.setState({ videoHidden: false });
    if (status === 'ended') this.seek(0);
    this.port.play();
  };

  pause = (): void => this.port.pause();

  toggle = (): void => {
    if (this.store.getState().status === 'playing') this.pause();
    else this.play();
  };

  seek = (seconds: number): void => {
    const target = clampTime(seconds, this.duration());
    this.port.seek(target);
    // Seeking from the end leaves it, whatever the player reports next.
    if (this.store.getState().status === 'ended') {
      this.store.setState({ status: 'paused' });
    }
    this.store.setState({ time: target });
  };

  skip = (seconds: number = SKIP_SECONDS): void =>
    this.seek(this.store.getState().time + seconds);

  setRate = (rate: number): void => {
    this.port.setRate(rate);
    this.store.setState({ rate });
  };

  toggleMuted = (): void => {
    const muted = !this.store.getState().muted;
    this.port.setMuted(muted);
    this.store.setState({ muted });
  };

  /** Collapses the dock to a line; YouTube may not play hidden, so it pauses. */
  hideVideo = (): void => {
    this.port.pause();
    this.stopLoop();
    this.store.setState({ videoHidden: true });
    if (this.store.getState().status === 'playing') {
      this.store.setState({ status: 'paused' });
    }
  };

  dispose = (): void => {
    this.stopLoop();
    this.stopListening();
    this.port.destroy();
  };

  private duration(): number {
    return this.port.duration() || this.store.getState().duration;
  }

  private readonly onPlayerState = (state: PlayerState): void => {
    if (state === 'playing') this.startLoop();
    else this.stopLoop();
    const duration = this.duration();
    this.store.setState({
      status: STATUS_OF[state],
      duration,
      time: state === 'ended' ? duration : this.port.currentTime(),
    });
  };

  private readonly tick = (): void => {
    const { time, duration } = this.store.getState();
    const now = this.port.currentTime();
    if (now !== time) this.store.setState({ time: now });
    if (duration === 0 && this.port.duration() > 0) {
      this.store.setState({ duration: this.port.duration() });
    }
    this.frame = this.frames.request(this.tick);
  };

  private startLoop(): void {
    if (this.frame === null) this.frame = this.frames.request(this.tick);
  }

  private stopLoop(): void {
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
  }
}
