import { decodeActivation } from './crepe';
import type { PitchReading } from './yin';

const MIN_PEAK = 0.1;
const MAX_CANDIDATES = 8;

function peakBins(activation: ArrayLike<number>): number[] {
  const peaks: number[] = [];
  for (let bin = 0; bin < activation.length; bin += 1) {
    const value = activation[bin] ?? 0;
    const before = activation[bin - 1] ?? value;
    const after = activation[bin + 1] ?? value;
    if (value >= MIN_PEAK && value > before && value >= after) peaks.push(bin);
    else if (bin === 0 && value >= MIN_PEAK && value > after) peaks.push(bin);
  }
  peaks.sort((a, b) => (activation[b] ?? 0) - (activation[a] ?? 0));
  return peaks;
}

/** Keeps competing model peaks available to the temporal tracker. */
export function pitchCandidates(activation: ArrayLike<number>): PitchReading[] {
  const selected: number[] = [];
  const readings: PitchReading[] = [];
  for (const peak of peakBins(activation)) {
    // Peaks inside one averaging neighbourhood are the same hypothesis.
    if (selected.some((previous) => Math.abs(previous - peak) <= 4)) continue;
    const reading = decodeActivation(activation, peak);
    if (reading) {
      selected.push(peak);
      readings.push(reading);
    }
    if (readings.length === MAX_CANDIDATES) break;
  }
  return readings;
}
