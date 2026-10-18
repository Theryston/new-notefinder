/**
 * Counts the time the User has been singing, so heartbeats can report it.
 * Time is read from a monotonic clock the caller passes in (milliseconds), so
 * it is immune to the system clock changing and easy to test.
 */
export type PracticeMeter = {
  /** Tells the meter whether the User is singing from `nowMs` on. */
  setPlaying(playing: boolean, nowMs: number): void;
  /**
   * The whole seconds of practice since the last `take`, which are then
   * forgotten. The fraction of a second stays for the next one, so no time is
   * lost to rounding.
   */
  take(nowMs: number): number;
};

export function createPracticeMeter(): PracticeMeter {
  let settledMs = 0;
  let playingSinceMs: number | null = null;

  const totalMs = (nowMs: number) =>
    settledMs + (playingSinceMs === null ? 0 : nowMs - playingSinceMs);

  return {
    setPlaying(playing, nowMs) {
      if (playing === (playingSinceMs !== null)) return;
      if (playing) {
        playingSinceMs = nowMs;
        return;
      }
      settledMs = totalMs(nowMs);
      playingSinceMs = null;
    },
    take(nowMs) {
      const total = totalMs(nowMs);
      const whole = Math.floor(total / 1000);
      settledMs = total - whole * 1000;
      if (playingSinceMs !== null) playingSinceMs = nowMs;
      return whole;
    },
  };
}
