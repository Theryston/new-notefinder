import type { Transcription } from '../../integrations/openai/transcription-output.js';

// The Timed lyrics of a transcription (CONTEXT.md "Timed lyrics"), as pure data:
// a segment is a line, its words are the words it covers. A word no segment
// covers is not dropped, it forms a line of its own timed by its words.

/** One word of Timed lyrics, timed to the Track's audio in seconds. */
type TimedLyricWord = { text: string; start: number; end: number };

/** One line of Timed lyrics: its words, in the order they are sung. */
export type TimedLyricLine = {
  start: number;
  end: number;
  words: TimedLyricWord[];
};

type Segment = Transcription['segments'][number];

/** A line under construction: its segment, or none for words no segment covers. */
type LineInProgress = {
  segment: Segment | null;
  start: number;
  end: number;
  words: TimedLyricWord[];
};

const byStart = <T extends { start: number }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.start - b.start);

/** The segment whose span holds the start of a word: a segment includes its start, not its end. */
const segmentOf = (segments: readonly Segment[], start: number) =>
  segments.find((segment) => segment.start <= start && start < segment.end) ??
  null;

/** The words that have text, trimmed of the blank Whisper puts before each one. */
const wordsOf = (words: Transcription['words']): TimedLyricWord[] =>
  words.flatMap(({ word, start, end }) => {
    const text = word.trim();
    return text === '' ? [] : [{ text, start, end }];
  });

/** A new line for a word: the segment's span, or the word's own for an uncovered word. */
const lineFor = (
  segment: Segment | null,
  first: TimedLyricWord,
): LineInProgress =>
  segment === null
    ? { segment, start: first.start, end: first.end, words: [] }
    : { segment, start: segment.start, end: segment.end, words: [] };

/**
 * The Timed lines of a transcription. Consecutive words that share a segment
 * share its line, and a word no segment covers starts a line that continues
 * while the next words are also uncovered. Lines come out in the order they are
 * sung; a segment without words makes no line.
 */
export const timedLyricsOf = (
  transcription: Transcription,
): TimedLyricLine[] => {
  const segments = byStart(transcription.segments);
  const lines: LineInProgress[] = [];
  for (const word of byStart(wordsOf(transcription.words))) {
    const segment = segmentOf(segments, word.start);
    const last = lines.at(-1);
    const line =
      last !== undefined && last.segment === segment
        ? last
        : lineFor(segment, word);
    if (line !== last) {
      lines.push(line);
    }
    line.words.push(word);
    if (line.segment === null) {
      line.end = word.end;
    }
  }
  return lines.map(({ start, end, words }) => ({ start, end, words }));
};
