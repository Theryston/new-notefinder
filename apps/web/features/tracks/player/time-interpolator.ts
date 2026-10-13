/**
 * The longest the clock runs ahead of the player's last report. A stalled
 * player (buffering) stops reporting, and without a limit the timeline would
 * keep moving while the sound did not.
 */
export const MAX_EXTRAPOLATION_SECONDS = 0.6;

/** A new report this much behind the clock is jitter, not a real step back. */
const BACKWARD_JITTER_SECONDS = 0.12;

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

  /** Starts over at this moment, after a seek. */
  reset(time: number, now: number): void {
    this.anchorTime = time;
    this.anchorAt = now;
    this.lastReported = time;
    this.lastRead = time;
  }

  /** Feeds one player report and returns the moment to draw. */
  read(input: InterpolatorInput): number {
    const { reported, now, playing, rate } = input;
    const changed =
      reported !== this.lastReported ||
      playing !== this.lastPlaying ||
      rate !== this.lastRate;
    if (changed) this.reanchor(input);
    this.lastReported = reported;
    this.lastPlaying = playing;
    this.lastRate = rate;
    this.lastRead = playing ? this.extrapolate(now, rate) : this.anchorTime;
    return this.lastRead;
  }

  private reanchor({ reported, now, playing }: InterpolatorInput): void {
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
