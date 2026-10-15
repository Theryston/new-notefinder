import type { TrackLyricLine } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import { lineIndexAt, lyricsSignatureAt, wordStateAt } from './lyrics-position';

const lines: TrackLyricLine[] = [
  {
    start: 2,
    end: 4,
    words: [
      { text: 'Is', start: 2, end: 3 },
      { text: 'this', start: 3, end: 4 },
    ],
  },
  { start: 10, end: 12, words: [{ text: 'Mamma', start: 10, end: 12 }] },
  { start: 20, end: 21, words: [{ text: 'Easy', start: 20, end: 21 }] },
];

describe('lineIndexAt', () => {
  it('is -1 before the first line starts', () => {
    expect(lineIndexAt(lines, 0)).toBe(-1);
    expect(lineIndexAt(lines, 1.99)).toBe(-1);
  });

  it('is -1 without lines', () => {
    expect(lineIndexAt([], 5)).toBe(-1);
  });

  it('picks a line from the moment it starts', () => {
    expect(lineIndexAt(lines, 2)).toBe(0);
    expect(lineIndexAt(lines, 10)).toBe(1);
    expect(lineIndexAt(lines, 20)).toBe(2);
  });

  it('keeps the line active through the gap before the next one', () => {
    expect(lineIndexAt(lines, 5)).toBe(0);
    expect(lineIndexAt(lines, 15)).toBe(1);
  });

  it('keeps the last line after it ends', () => {
    expect(lineIndexAt(lines, 999)).toBe(2);
  });
});

describe('wordStateAt', () => {
  const word = { text: 'this', start: 3, end: 4 };

  it('is upcoming before the word starts', () => {
    expect(wordStateAt(word, 2.99)).toBe('upcoming');
  });

  it('is current from its start until just before its end', () => {
    expect(wordStateAt(word, 3)).toBe('current');
    expect(wordStateAt(word, 3.99)).toBe('current');
  });

  it('is sung once it ends', () => {
    expect(wordStateAt(word, 4)).toBe('sung');
    expect(wordStateAt(word, 50)).toBe('sung');
  });
});

describe('lyricsSignatureAt', () => {
  it('stays the same while nothing visible changes', () => {
    expect(lyricsSignatureAt(lines, 2.1)).toBe(lyricsSignatureAt(lines, 2.9));
    expect(lyricsSignatureAt(lines, 5)).toBe(lyricsSignatureAt(lines, 8));
  });

  it('changes when a word starts or ends', () => {
    expect(lyricsSignatureAt(lines, 2.9)).not.toBe(lyricsSignatureAt(lines, 3));
    expect(lyricsSignatureAt(lines, 3.9)).not.toBe(lyricsSignatureAt(lines, 4));
  });

  it('changes when the active line changes', () => {
    expect(lyricsSignatureAt(lines, 9.9)).not.toBe(
      lyricsSignatureAt(lines, 10),
    );
  });

  it('tells the moment before any line from a moment inside the first', () => {
    expect(lyricsSignatureAt(lines, 0)).not.toBe(lyricsSignatureAt(lines, 2));
  });

  it('is stable without lines', () => {
    expect(lyricsSignatureAt([], 0)).toBe(lyricsSignatureAt([], 30));
  });
});
