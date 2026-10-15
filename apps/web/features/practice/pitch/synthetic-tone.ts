/**
 * A tone for the detector's tests: a fundamental plus harmonics (each given as
 * its amplitude relative to the fundamental), like a singing voice has.
 */
export function syntheticTone({
  frequency,
  sampleRate,
  length,
  harmonics = [],
  amplitude = 0.5,
  start = 0,
}: {
  frequency: number;
  sampleRate: number;
  length: number;
  harmonics?: readonly number[];
  amplitude?: number;
  /** The first sample's index, so consecutive blocks stay in phase. */
  start?: number;
}): Float32Array {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = (start + i) / sampleRate;
    let value = Math.sin(2 * Math.PI * frequency * t);
    harmonics.forEach((relative, index) => {
      value += relative * Math.sin(2 * Math.PI * frequency * (index + 2) * t);
    });
    samples[i] = amplitude * value;
  }
  return samples;
}
