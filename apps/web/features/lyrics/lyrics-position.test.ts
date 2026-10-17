import type { TrackLyricLine } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import {
  karaokeLineAt,
  lineIndexAt,
  lyricsSignatureAt,
  wordStateAt,
} from './lyrics-position';

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

describe('karaokeLineAt', () => {
  it('is -1 without lines', () => {
    expect(karaokeLineAt([], 5)).toBe(-1);
  });

  it('previews the first line before it starts', () => {
    expect(karaokeLineAt(lines, 0)).toBe(0);
    expect(karaokeLineAt(lines, 1.99)).toBe(0);
  });

  it('shows the line while it is sung', () => {
    expect(karaokeLineAt(lines, 2)).toBe(0);
    expect(karaokeLineAt(lines, 10)).toBe(1);
  });

  it('holds the finished line briefly, then previews the next one', () => {
    expect(karaokeLineAt(lines, 5)).toBe(0);
    expect(karaokeLineAt(lines, 6)).toBe(0);
    expect(karaokeLineAt(lines, 6.01)).toBe(1);
    expect(karaokeLineAt(lines, 8)).toBe(1);
  });

  it('measures the hold from the last word end when it passes the line end', () => {
    const skewed: TrackLyricLine[] = [
      {
        start: 0,
        end: 1,
        words: [{ text: 'Hey', start: 0, end: 5 }],
      },
    ];
    expect(karaokeLineAt(skewed, 6)).toBe(0);
    expect(karaokeLineAt(skewed, 7.01)).toBe(-1);
  });

  it('clears the slot after the last line', () => {
    expect(karaokeLineAt(lines, 22)).toBe(2);
    expect(karaokeLineAt(lines, 23)).toBe(2);
    expect(karaokeLineAt(lines, 999)).toBe(-1);
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
    expect(lyricsSignatureAt(lines, 5)).toBe(lyricsSignatureAt(lines, 5.5));
    expect(lyricsSignatureAt(lines, 7)).toBe(lyricsSignatureAt(lines, 8));
  });

  it('changes when the karaoke slot moves on after the hold', () => {
    expect(lyricsSignatureAt(lines, 5)).not.toBe(lyricsSignatureAt(lines, 8));
    expect(lyricsSignatureAt(lines, 22)).not.toBe(
      lyricsSignatureAt(lines, 999),
    );
  });

  it('changes when a word starts or ends', () => {
    expect(lyricsSignatureAt(lines, 2.9)).not.toBe(lyricsSignatureAt(lines, 3));
    expect(lyricsSignatureAt(lines, 3.9)).not.toBe(lyricsSignatureAt(lines, 4));
  });

  it('changes when a word of the previewed line starts', () => {
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
