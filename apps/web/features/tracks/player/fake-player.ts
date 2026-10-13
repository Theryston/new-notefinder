import { BasePlayer } from './base-player';
import type { PlayerPort } from './player-port';

export type FakePlayerOptions = {
  /** The length of the pretend video, in seconds. */
  durationSeconds: number;
  /** The wall clock in milliseconds; injectable so a test can drive it. */
  now?: () => number;
};

/**
 * A player with no video: a clock that runs while "playing". Used only in e2e
 * builds (the server env flag `E2E_FAKE_PLAYER`), so the page is tested
 * without the YouTube IFrame API, which cannot load there.
 */
export class FakePlayer extends BasePlayer implements PlayerPort {
  private readonly length: number;
  private readonly now: () => number;
  private playing = false;
  private rate = 1;
  /** The moment of the Track at `startedAt`, while playing; else the moment. */
  private anchor = 0;
  private startedAt = 0;
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({
    durationSeconds,
    now = () => performance.now(),
  }: FakePlayerOptions) {
    super();
    this.length = durationSeconds;
    this.now = now;
  }

  load(): Promise<void> {
    return Promise.resolve().then(() => {
      this.ready = true;
      this.emit('ready');
    });
  }

  play(): void {
    if (!this.ready || this.playing) return;
    this.playing = true;
    this.startedAt = this.now();
    this.scheduleEnd();
    this.emit('playing');
  }

  pause(): void {
    if (!this.playing) return;
    this.anchor = this.currentTime();
    this.playing = false;
    this.clearEnd();
    this.emit('paused');
  }

  seek(seconds: number): void {
    this.anchor = Math.min(Math.max(0, seconds), this.length);
    this.startedAt = this.now();
    if (this.playing) this.scheduleEnd();
  }

  currentTime(): number {
    if (!this.playing) return this.anchor;
    const elapsed = ((this.now() - this.startedAt) / 1000) * this.rate;
    return Math.min(this.anchor + elapsed, this.length);
  }

  duration(): number {
    return this.ready ? this.length : 0;
  }

  setRate(rate: number): void {
    this.anchor = this.currentTime();
    this.startedAt = this.now();
    this.rate = rate;
    if (this.playing) this.scheduleEnd();
  }

  destroy(): void {
    this.clearEnd();
    this.clearListeners();
  }

  /** Makes the pretend video fail, as an unplayable YouTube one would. */
  fail(): void {
    this.emit('error');
  }

  setMuted(): void {
    // Nothing to silence.
  }

  private scheduleEnd(): void {
    this.clearEnd();
    const remainingMs = ((this.length - this.currentTime()) / this.rate) * 1000;
    this.endTimer = setTimeout(() => {
      this.anchor = this.length;
      this.playing = false;
      this.emit('ended');
    }, remainingMs);
  }

  private clearEnd(): void {
    if (this.endTimer !== null) clearTimeout(this.endTimer);
    this.endTimer = null;
  }
}
