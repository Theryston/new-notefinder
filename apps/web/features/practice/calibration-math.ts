/** Residual wall-clock delay after the existing automatic compensation. */
export function calibrationOffset(samples: readonly number[]): number | null {
  if (
    samples.length < 3 ||
    samples.some((value) => !Number.isFinite(value) || Math.abs(value) > 1)
  )
    return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (
    median === undefined ||
    sorted.some((value) => Math.abs(value - median) > 0.15)
  )
    return null;
  return median;
}

/** Calibration is wall-clock time; the voice line uses Track seconds. */
export function shiftedVoiceTime(
  time: number,
  offset: number,
  rate: number,
): number {
  return time - offset * rate;
}
