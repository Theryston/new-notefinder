import { lyricsSearchText, stripLrcTags } from './lyrics-index.js';

describe('stripLrcTags', () => {
  it('drops the timestamps and keeps the lines', () => {
    expect(stripLrcTags('[00:12.00] Look at the stars\n[00:15.50] hello')).toBe(
      'Look at the stars\nhello',
    );
  });

  it('drops stacked tags and lines that hold nothing else', () => {
    expect(stripLrcTags('[00:12.00][00:14.00] hello\n[00:16.00]\nworld')).toBe(
      'hello\nworld',
    );
  });

  it('keeps lines without tags as they are', () => {
    expect(stripLrcTags('no tags here')).toBe('no tags here');
  });
});

describe('lyricsSearchText', () => {
  it('prefers the plain Lyrics', () => {
    expect(lyricsSearchText('plain words', '[00:01.00] synced words')).toBe(
      'plain words',
    );
  });

  it('falls back to the synced lines without their timestamps', () => {
    expect(lyricsSearchText(null, '[00:01.00] synced words')).toBe(
      'synced words',
    );
  });

  it('treats blank plain Lyrics as missing', () => {
    expect(lyricsSearchText('   ', '[00:01.00] synced words')).toBe(
      'synced words',
    );
  });

  it('answers undefined when there is nothing to index', () => {
    expect(lyricsSearchText(null, null)).toBe(undefined);
    expect(lyricsSearchText(null, '[00:01.00]')).toBe(undefined);
    expect(lyricsSearchText('', '')).toBe(undefined);
  });
});
