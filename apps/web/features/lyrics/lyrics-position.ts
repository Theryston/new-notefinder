import type { TrackLyricLine, TrackLyricWord } from '@notefinder/contracts';

/** Where a word is in the song at a moment: sung, being sung, or still to come. */
export type WordState = 'sung' | 'current' | 'upcoming';

/**
 * The line being sung at `time`: the last one that has started, so it stays
 * the active one through the gap before the next line. -1 before the first.
 */
export function lineIndexAt(
  lines: readonly TrackLyricLine[],
  time: number,
): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((lines[middle]?.start ?? Number.POSITIVE_INFINITY) <= time) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/** A word is sung once it ends and being sung from its start until then. */
export function wordStateAt(word: TrackLyricWord, time: number): WordState {
  if (word.end <= time) return 'sung';
  return word.start <= time ? 'current' : 'upcoming';
}

const WORDS_PER_STEP = 1_000;
const LINES_STEP = WORDS_PER_STEP * WORDS_PER_STEP;

/**
 * One number that changes exactly when what the lyrics show changes: the active
 * line, or a word of it starting or ending. It lets the lyrics follow a clock
 * that ticks every frame while rendering only a few times a second.
 */
export function lyricsSignatureAt(
  lines: readonly TrackLyricLine[],
  time: number,
): number {
  const index = lineIndexAt(lines, time);
  const words = lines[index]?.words ?? [];
  const started = words.filter((word) => word.start <= time).length;
  const ended = words.filter((word) => word.end <= time).length;
  return (index + 1) * LINES_STEP + started * WORDS_PER_STEP + ended;
}
