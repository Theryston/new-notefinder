/** Goertzel measures one spectral peak without a full FFT. */
function power(samples: Float32Array, frequency: number): number {
  const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / 16_000);
  let previous = 0;
  let before = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const next = (samples[index] ?? 0) + coefficient * previous - before;
    before = previous;
    previous = next;
  }
  return Math.max(
    0,
    previous ** 2 + before ** 2 - coefficient * previous * before,
  );
}

/** A detectable fundamental must stand above nearby noise and its harmonics. */
function hasFundamental(frame: Float32Array, midi: number): boolean {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const binWidth = 16_000 / frame.length;
  const fundamental = power(frame, frequency);
  const noise = Math.max(
    power(frame, frequency - 2 * binWidth),
    power(frame, frequency + 2 * binWidth),
    Number.EPSILON,
  );
  const harmonic = power(frame, frequency * 2);
  return fundamental > noise * 4 && fundamental > harmonic * 0.0002;
}

/** Resolves an octave hypothesis only when the waveform supports its root. */
export function resolveOctave(
  frame: Float32Array,
  previous: number,
  midi: number,
): number | null {
  if (Math.abs(Math.abs(midi - previous) - 12) > 0.75) return null;
  const low = midi > previous ? midi - 12 : midi;
  // A Hann window isolates the root from neighbouring peaks and leakage.
  const windowed = frame.map(
    (sample, index) =>
      sample *
      (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (frame.length - 1))),
  );
  if (hasFundamental(windowed, low)) return low;
  return hasFundamental(windowed, low + 12) ? low + 12 : null;
}
