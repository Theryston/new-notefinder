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
  private playGate:
    | ((start: () => void) => (() => void) | undefined)
    | undefined;
  private cancelPlay: (() => void) | null = null;
  private playGeneration = 0;
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

  /** Programmatic resumes (including loop repeats) never count in. */
  play = (): void => {
    const { status } = this.store.getState();
    if (status === 'loading' || status === 'error' || status === 'playing')
      return;
    this.cancelPendingPlay();
    if (status === 'ended') this.seek(0);
    this.port.play();
  };

  private requestPlay(): void {
    const { status } = this.store.getState();
    if (status === 'loading' || status === 'error') return;
    if (status === 'playing' || this.cancelPlay) return;
    const generation = ++this.playGeneration;
    const start = () => {
      if (generation !== this.playGeneration) return;
      this.cancelPlay = null;
      if (this.store.getState().status === 'ended') this.seek(0);
      this.port.play();
    };
    if (this.playGate) this.cancelPlay = this.playGate(start) ?? null;
    else start();
  }

  setPlayGate = (gate: typeof this.playGate): void => {
    this.cancelPendingPlay();
    this.playGate = gate;
  };

  cancelPendingPlay(): void {
    this.playGeneration += 1;
    this.cancelPlay?.();
    this.cancelPlay = null;
  }

  pause = (): void => {
    this.cancelPendingPlay();
    this.port.pause();
  };

  toggle = (): void => {
    if (this.cancelPlay || this.store.getState().status === 'playing')
      this.pause();
    else this.requestPlay();
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

  /**
   * The Track's length from its header can arrive after the player exists
   * (it falls back to the notes); the player's own length wins once known.
   */
  setDurationHint = (seconds: number): void => {
    if (this.port.duration() > 0) return;
    if (this.store.getState().duration !== seconds) {
      this.store.setState({ duration: seconds });
    }
  };

  dispose = (): void => {
    this.cancelPendingPlay();
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
    if (state === 'error') {
      this.store.setState({ status: 'error' });
      return;
    }
    const duration = this.duration();
    this.store.setState({
      status: state,
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
