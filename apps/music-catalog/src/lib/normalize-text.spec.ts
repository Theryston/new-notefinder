import { normalizeLyricsText } from './normalize-text.js';

describe('normalizeLyricsText', () => {
  it('lowercases and collapses punctuation and whitespace', () => {
    expect(normalizeLyricsText('  Hello,   WORLD! ')).toBe('hello world');
  });

  it('strips accents', () => {
    expect(normalizeLyricsText('Café Beyoncé naïve')).toBe(
      'cafe beyonce naive',
    );
  });

  it('keeps extra words like live or remix, so they never match', () => {
    expect(normalizeLyricsText('Song (Live)')).toBe('song live');
    expect(normalizeLyricsText('Song - Remix!')).toBe('song remix');
  });

  it('keeps letters of other scripts instead of dropping them', () => {
    expect(normalizeLyricsText('夜曲')).toBe('夜曲');
    expect(normalizeLyricsText('夜曲')).not.toBe(normalizeLyricsText('晴天'));
  });

  it('normalizes an empty or blank text to nothing', () => {
    expect(normalizeLyricsText('')).toBe('');
    expect(normalizeLyricsText('  ...  ')).toBe('');
  });
});
