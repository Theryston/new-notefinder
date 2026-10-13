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
  private rate = 1;
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
            this.ready = true;
            this.emit('ready');
            resolve();
          },
          onStateChange: ({ data }) => this.onYouTubeState(data),
        },
      });
    });
  }

  play(): void {
    this.handle?.playVideo();
  }

  pause(): void {
    this.handle?.pauseVideo();
  }

  seek(seconds: number): void {
    this.handle?.seekTo(seconds, true);
    this.clock.reset(seconds, this.now());
  }

  currentTime(): number {
    if (!this.handle) return 0;
    return this.clock.read({
      reported: this.handle.getCurrentTime(),
      now: this.now(),
      playing: this.playing,
      rate: this.rate,
    });
  }

  duration(): number {
    return this.handle?.getDuration() ?? 0;
  }

  setRate(rate: number): void {
    this.rate = rate;
    this.handle?.setPlaybackRate(rate);
  }

  setMuted(muted: boolean): void {
    if (muted) this.handle?.mute();
    else this.handle?.unMute();
  }

  destroy(): void {
    this.handle?.destroy();
    this.handle = null;
    this.mount?.remove();
    this.clearListeners();
  }

  private onYouTubeState(data: number): void {
    const state = STATE_OF[data];
    if (!state) return;
    this.playing = state === 'playing';
    this.emit(state);
  }
}
