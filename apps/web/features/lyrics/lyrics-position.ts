import type { TrackLyricLine, TrackLyricWord } from '@vozzify/contracts';

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

/** How long the karaoke slot keeps a finished line before moving on. */
const KARAOKE_HOLD_SECONDS = 2;

function sungUntil(line: TrackLyricLine): number {
  let end = line.end;
  for (const word of line.words) {
    if (word.end > end) end = word.end;
  }
  return end;
}

/**
 * The line the single-line karaoke slot shows at `time`, or -1 when the slot
 * stays empty. Before the first line it previews that line as what comes
 * next; after a line ends it holds it for `holdSeconds`, then previews the
 * next line (read-ahead) or, after the last one, clears the slot. The full
 * lyrics list keeps using `lineIndexAt` and is unaffected.
 */
export function karaokeLineAt(
  lines: readonly TrackLyricLine[],
  time: number,
): number {
  if (lines.length === 0) return -1;
  const index = lineIndexAt(lines, time);
  if (index < 0) return 0;
  const line = lines[index];
  if (line === undefined) return -1;
  if (time <= sungUntil(line) + KARAOKE_HOLD_SECONDS) return index;
  return index + 1 < lines.length ? index + 1 : -1;
}

/**
 * One number that changes exactly when what the lyrics show changes: the
 * karaoke slot's line, or a word of it starting or ending. It lets the lyrics
 * follow a clock that ticks every frame while rendering only a few times a
 * second. The slot's line comes from `karaokeLineAt`, so the hold boundaries
 * also trigger a render.
 */
export function lyricsSignatureAt(
  lines: readonly TrackLyricLine[],
  time: number,
): number {
  const display = karaokeLineAt(lines, time);
  const words = (display < 0 ? undefined : lines[display]?.words) ?? [];
  const started = words.filter((word) => word.start <= time).length;
  const ended = words.filter((word) => word.end <= time).length;
  return (display + 1) * LINES_STEP + started * WORDS_PER_STEP + ended;
}
