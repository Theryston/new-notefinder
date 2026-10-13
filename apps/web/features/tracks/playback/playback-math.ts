/** How far the arrow keys skip, in seconds (spec #160, story 24). */
export const SKIP_SECONDS = 5;

/** Keeps a moment inside the Track; an unknown length (0) only bounds below. */
export function clampTime(time: number, duration: number): number {
  const bounded = Math.max(0, time);
  return duration > 0 ? Math.min(bounded, duration) : bounded;
}

/** The moment at a position (0 to 1) along the progress track. */
export function timeAtFraction(fraction: number, duration: number): number {
  return Math.min(1, Math.max(0, fraction)) * duration;
}

/** The position (0 to 1) of a moment along the progress track. */
export function fractionOfTime(time: number, duration: number): number {
  return duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
}

/** The share of a track a pointer at `clientX` sits at, for a box on screen. */
export function fractionAtPointer(
  clientX: number,
  box: { left: number; width: number },
): number {
  if (box.width <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - box.left) / box.width));
}
