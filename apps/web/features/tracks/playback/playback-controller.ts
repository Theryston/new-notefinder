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
  private playFrame: number | null = null;
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
    store.setState({
      ...initialPlaybackState,
      duration: durationHint,
      transpose: store.getState().transpose,
    });
    this.stopListening = port.onState(this.onPlayerState);
  }

  play = (): void => {
    const { status, videoHidden } = this.store.getState();
    if (status === 'loading' || status === 'error') return;
    if (status === 'ended') this.seek(0);
    if (!videoHidden) {
      this.port.play();
      return;
    }
    // YouTube may not play while its iframe is hidden, so the video is shown
    // first and played once the screen has drawn it (the next frame).
    this.store.setState({ videoHidden: false });
    this.cancelPendingPlay();
    this.playFrame = this.frames.request(() => {
      this.playFrame = null;
      this.port.play();
    });
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
    this.cancelPendingPlay();
    this.port.pause();
    this.stopLoop();
    this.store.setState({ videoHidden: true });
    if (this.store.getState().status === 'playing') {
      this.store.setState({ status: 'paused' });
    }
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

  private cancelPendingPlay(): void {
    if (this.playFrame !== null) this.frames.cancel(this.playFrame);
    this.playFrame = null;
  }

  private startLoop(): void {
    if (this.frame === null) this.frame = this.frames.request(this.tick);
  }

  private stopLoop(): void {
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
  }
}
