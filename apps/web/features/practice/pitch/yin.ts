/** One reading of the voice: its fundamental and how sure the detector is. */
export type PitchReading = { frequency: number; confidence: number };

/** The range of a singing voice, wider than any one singer's. */
const MIN_FREQUENCY = 70;
const MAX_FREQUENCY = 1100;

/** YIN's absolute threshold: the first dip below it is the period. */
const YIN_THRESHOLD = 0.15;

/** Quieter than this (RMS of a -1..1 signal) is silence, not a quiet voice. */
const SILENCE_RMS = 0.01;

function rootMeanSquare(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/** YIN's cumulative mean normalized difference, for lags up to `maxLag`. */
function normalizedDifference(samples: Float32Array, maxLag: number) {
  const window = samples.length - maxLag;
  const result = new Float32Array(maxLag + 1);
  result[0] = 1;
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    let difference = 0;
    for (let i = 0; i < window; i += 1) {
      const delta = (samples[i] ?? 0) - (samples[i + lag] ?? 0);
      difference += delta * delta;
    }
    running += difference;
    result[lag] = running === 0 ? 1 : (difference * lag) / running;
  }
  return result;
}

/** The first lag whose dip passes the threshold, followed down to its floor. */
function firstDip(diff: Float32Array, minLag: number, maxLag: number): number {
  for (let lag = minLag; lag < maxLag; lag += 1) {
    if ((diff[lag] ?? 1) >= YIN_THRESHOLD) continue;
    let floor = lag;
    while (floor + 1 < maxLag && (diff[floor + 1] ?? 1) < (diff[floor] ?? 1)) {
      floor += 1;
    }
    return floor;
  }
  return -1;
}

/** Refines a lag below one sample with a parabola through its neighbours. */
function interpolate(diff: Float32Array, lag: number): number {
  const before = diff[lag - 1] ?? diff[lag] ?? 0;
  const here = diff[lag] ?? 0;
  const after = diff[lag + 1] ?? here;
  const curve = before - 2 * here + after;
  if (curve === 0) return lag;
  return lag + (before - after) / (2 * curve);
}

/** Whether a window is too quiet to hold a voice. */
export function isSilent(samples: Float32Array): boolean {
  return rootMeanSquare(samples) < SILENCE_RMS;
}

/**
 * The classic YIN detector (de Cheveigné and Kawahara, 2002): the voice's
 * fundamental in one window of mic samples, or null for silence and noise.
 * Harmonics do not fool it into reporting an octave up, which is what a
 * singer's rich voice would do to a plain autocorrelation.
 */
export function detectPitchYin(
  samples: Float32Array,
  sampleRate: number,
): PitchReading | null {
  if (isSilent(samples)) return null;
  const minLag = Math.floor(sampleRate / MAX_FREQUENCY);
  const maxLag = Math.min(
    Math.ceil(sampleRate / MIN_FREQUENCY),
    Math.floor(samples.length / 2),
  );
  const diff = normalizedDifference(samples, maxLag);
  const lag = firstDip(diff, Math.max(minLag, 2), maxLag);
  if (lag < 0) return null;
  const period = interpolate(diff, lag);
  return {
    frequency: sampleRate / period,
    confidence: Math.max(0, Math.min(1, 1 - (diff[lag] ?? 1))),
  };
}
