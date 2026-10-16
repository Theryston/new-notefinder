/** Residual wall-clock delay after the existing automatic compensation. */
export function calibrationOffset(samples: readonly number[]): number | null {
  const valid = samples.filter(
    (value) => Number.isFinite(value) && Math.abs(value) <= 1,
  );
  if (valid.length < 3) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median === undefined) return null;
  // Early beats often slip while the singer locks onto the rhythm; keep the
  // inliers around the median as long as at least three consistent beats remain.
  const inliers = sorted.filter((value) => Math.abs(value - median) <= 0.18);
  if (inliers.length < 3 || inliers.length * 2 < valid.length) return null;
  return inliers[Math.floor(inliers.length / 2)] ?? null;
}

/** Calibration is wall-clock time; the voice line uses Track seconds. */
export function shiftedVoiceTime(
  time: number,
  offset: number,
  rate: number,
): number {
  return time - offset * rate;
}
