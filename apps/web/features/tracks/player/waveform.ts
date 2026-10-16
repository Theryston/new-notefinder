/** Peak amplitudes in equal-duration bins, normalized to the source's peak. */
export function waveformPeaks(samples: Float32Array, bins = 120): number[] {
  if (samples.length === 0 || bins <= 0) return [];
  const count = Math.min(bins, samples.length);
  const peaks = Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * samples.length) / count);
    const end = Math.floor(((index + 1) * samples.length) / count);
    let peak = 0;
    for (let sample = start; sample < end; sample++) {
      peak = Math.max(peak, Math.abs(samples[sample] ?? 0));
    }
    return peak;
  });
  const maximum = Math.max(...peaks);
  return maximum === 0 ? peaks : peaks.map((peak) => peak / maximum);
}

/** Media playback changes pitch with rate; the effect cancels that change. */
export function compensatedPitch(semitones: number, rate: number): number {
  return semitones - 12 * Math.log2(rate);
}
