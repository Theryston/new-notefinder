import { BasePlayer } from './base-player';
import type { PlayerPort, PlayerState } from './player-port';
import { YOUTUBE_SQUARE_PX } from './player-port';
import { TimeInterpolator } from './time-interpolator';
import {
  type YouTubeApi,
  type YouTubePlayerHandle,
  YT_STATE,
} from './youtube-api';

const STATE_OF: Partial<Record<number, PlayerState>> = {
  [YT_STATE.playing]: 'playing',
  [YT_STATE.paused]: 'paused',
  [YT_STATE.ended]: 'ended',
};

/**
 * The YouTube implementation of the player port. The video shows in a square
 * of {@link YOUTUBE_SQUARE_PX}; its controls are off, since the dock has them.
 * `currentTime()` is interpolated between YouTube's coarse reports.
 */
export class YouTubePlayer extends BasePlayer implements PlayerPort {
  private handle: YouTubePlayerHandle | null = null;
  private mount: HTMLElement | null = null;
  private playing = false;
  private destroyed = false;
  private rate = 1;
  private muted = false;
  /** A seek asked for before the player was ready, applied once it is. */
  private pendingSeek: number | null = null;
  private readonly clock = new TimeInterpolator();

  constructor(
    private readonly host: HTMLElement,
    private readonly api: YouTubeApi,
    private readonly now: () => number = () => performance.now(),
  ) {
    super();
  }

  load(videoId: string): Promise<void> {
    return new Promise((resolve) => {
      // The API replaces the element it is given with the iframe, so it gets
      // a child of the host that React never owns.
      this.mount = this.host.ownerDocument.createElement('div');
      this.host.append(this.mount);
      this.handle = new this.api.Player(this.mount, {
        width: YOUTUBE_SQUARE_PX,
        height: YOUTUBE_SQUARE_PX,
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            this.onYouTubeReady();
            resolve();
          },
          onStateChange: ({ data }) => this.onYouTubeState(data),
          onError: () => this.emit('error'),
        },
      });
    });
  }

  play(): void {
    this.live()?.playVideo();
  }

  pause(): void {
    this.live()?.pauseVideo();
  }

  seek(seconds: number): void {
    this.clock.reset(seconds, this.now());
    const live = this.live();
    if (live) live.seekTo(seconds, true);
    else this.pendingSeek = seconds;
  }

  currentTime(): number {
    const live = this.live();
    if (!live) return this.pendingSeek ?? 0;
    return this.clock.read({
      reported: live.getCurrentTime(),
      now: this.now(),
      playing: this.playing,
      rate: this.rate,
    });
  }

  duration(): number {
    return this.live()?.getDuration() ?? 0;
  }

  setRate(rate: number): void {
    this.rate = rate;
    this.live()?.setPlaybackRate(rate);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMuted(this.live());
  }

  destroy(): void {
    this.destroyed = true;
    // Before ready the handle has no methods, not even destroy: the iframe
    // the API swapped in for the mount is removed through the host.
    if (this.ready) this.handle?.destroy();
    else this.host.replaceChildren();
    this.handle = null;
    this.mount?.remove();
    this.clearListeners();
  }

  /**
   * The handle, only once YouTube has said it is ready: `new YT.Player()`
   * returns an object that gets its methods (getDuration, playVideo,
   * seekTo...) just before `onReady`, and calling one earlier throws.
   */
  private live(): YouTubePlayerHandle | null {
    return this.ready ? this.handle : null;
  }

  private onYouTubeReady(): void {
    if (this.destroyed) return;
    this.ready = true;
    // What was asked for while the player was loading.
    const live = this.live();
    if (live && this.rate !== 1) live.setPlaybackRate(this.rate);
    if (this.muted) this.applyMuted(live);
    if (live && this.pendingSeek !== null) live.seekTo(this.pendingSeek, true);
    this.pendingSeek = null;
    this.emit('ready');
  }

  private applyMuted(live: YouTubePlayerHandle | null): void {
    if (this.muted) live?.mute();
    else live?.unMute();
  }

  private onYouTubeState(data: number): void {
    const state = STATE_OF[data];
    if (!state || !this.ready) return;
    this.playing = state === 'playing';
    this.emit(state);
  }
}
