/** The share of today's target reached, from 0 to 1. */
export function ringProgress(
  listenedSeconds: number,
  targetSeconds: number,
): number {
  if (targetSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, listenedSeconds / targetSeconds));
}

/** Minutes and seconds the messages format ("4 min 30 s left today"). */
export function remainingParts(
  listenedSeconds: number,
  targetSeconds: number,
): { minutes: number; seconds: number } {
  const remaining = Math.max(0, targetSeconds - listenedSeconds);
  return {
    minutes: Math.floor(remaining / 60),
    seconds: Math.floor(remaining % 60),
  };
}
