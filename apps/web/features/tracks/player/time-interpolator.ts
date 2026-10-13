/**
 * The longest the clock runs ahead of the player's last report. A stalled
 * player (buffering) stops reporting, and without a limit the timeline would
 * keep moving while the sound did not.
 */
export const MAX_EXTRAPOLATION_SECONDS = 0.6;

/** A new report this much behind the clock is jitter, not a real step back. */
const BACKWARD_JITTER_SECONDS = 0.12;

/** A report this close to a seek target means the player got there. */
const SEEK_REACHED_SECONDS = 1;

/**
 * How long reports are ignored after a seek. YouTube keeps answering with the
 * time from before the seek for a moment; past this the player is believed
 * again, so a seek that never lands does not freeze the clock.
 */
export const SEEK_SETTLE_MS = 2000;

export type InterpolatorInput = {
  /** What the player reported, in seconds. */
  reported: number;
  /** The wall clock when it was read, in milliseconds. */
  now: number;
  playing: boolean;
  rate: number;
};

/**
 * Smooths a player's coarse time reports. YouTube's `getCurrentTime()` only
 * moves a few times a second, so the clock re-anchors when a report changes
 * and extrapolates with the wall clock in between, which is what lets the
 * timeline move at screen refresh rate.
 */
export class TimeInterpolator {
  private anchorTime = 0;
  private anchorAt = 0;
  private lastReported = 0;
  private lastPlaying = false;
  private lastRate = 1;
  private lastRead = 0;
  private seek: { target: number; at: number } | null = null;

  /**
   * Starts over at a seek target. Reports that have not reached it yet are
   * ignored, so the clock does not snap back to the time before the seek.
   */
  reset(time: number, now: number): void {
    this.anchorTime = time;
    this.anchorAt = now;
    this.lastRead = time;
    this.seek = { target: time, at: now };
  }

  /** Feeds one player report and returns the moment to draw. */
  read(input: InterpolatorInput): number {
    const { reported, now, playing, rate } = input;
    const settling = this.isSettling(reported, now);
    const changed =
      playing !== this.lastPlaying ||
      rate !== this.lastRate ||
      (!settling && reported !== this.lastReported);
    if (changed) this.reanchor(input, settling);
    if (!settling) this.lastReported = reported;
    this.lastPlaying = playing;
    this.lastRate = rate;
    this.lastRead = playing ? this.extrapolate(now, rate) : this.anchorTime;
    return this.lastRead;
  }

  /** Whether a seek is still waiting for the player to reach its target. */
  private isSettling(reported: number, now: number): boolean {
    if (!this.seek) return false;
    const reached =
      Math.abs(reported - this.seek.target) <= SEEK_REACHED_SECONDS;
    if (reached || now - this.seek.at > SEEK_SETTLE_MS) {
      // A report that is not exactly the target is news to the clock.
      this.lastReported = reported === this.seek.target ? reported : Number.NaN;
      this.seek = null;
      return false;
    }
    return true;
  }

  private reanchor(
    { reported, now, playing }: InterpolatorInput,
    settling: boolean,
  ): void {
    if (settling) {
      // Only play or rate changed: carry on from where the clock is.
      this.anchorTime = this.lastRead;
      this.anchorAt = now;
      return;
    }
    const behind = this.lastRead - reported;
    const jitter =
      playing &&
      this.lastPlaying &&
      behind > 0 &&
      behind < BACKWARD_JITTER_SECONDS;
    // Keep the clock where it is rather than step back a few milliseconds.
    this.anchorTime = jitter ? this.lastRead : reported;
    this.anchorAt = now;
  }

  private extrapolate(now: number, rate: number): number {
    const elapsed = Math.max(0, now - this.anchorAt) / 1000;
    return (
      this.anchorTime + Math.min(elapsed * rate, MAX_EXTRAPOLATION_SECONDS)
    );
  }
}
