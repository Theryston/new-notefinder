/** One voice reading on the Track's time; `midi: null` means unvoiced. */
export type BleedSample = { time: number; midi: number | null };

/** A vocal note the Track sings, already moved by the transposition. */
export type BleedNote = { start: number; end: number };

/**
 * Enough voiced readings to judge steadiness by. Fewer than this (a cough,
 * a count-in beep) never marks an attempt, whatever they sound like.
 */
const MIN_VOICED_SAMPLES = 30;

/**
 * Whether the music seems to have leaked into the mic: a steady voiced pitch
 * is detected while the Track has no vocal notes. "Steady" means most of the
 * uncovered voice sits within half a semitone of its own median, which is
 * how a loudspeaker's held note reads; a singer sliding between notes
 * spreads wider than that.
 */
export function suspectBleed(
  samples: readonly BleedSample[],
  notes: readonly BleedNote[],
): boolean {
  const voiced = samples.filter(
    (sample): sample is { time: number; midi: number } =>
      sample.midi !== null && Number.isFinite(sample.midi),
  );
  if (voiced.length < MIN_VOICED_SAMPLES) return false;
  const uncovered = voiced.filter(
    (sample) =>
      !notes.some(
        (note) => note.start <= sample.time && sample.time < note.end,
      ),
  );
  if (
    uncovered.length < MIN_VOICED_SAMPLES ||
    uncovered.length / voiced.length < 0.5
  ) {
    return false;
  }
  const midis = uncovered.map((sample) => sample.midi).sort((a, b) => a - b);
  const median = midis[Math.floor(midis.length / 2)] ?? 0;
  const steady =
    uncovered.filter((sample) => Math.abs(sample.midi - median) <= 0.5).length /
    uncovered.length;
  return steady >= 0.8;
}
