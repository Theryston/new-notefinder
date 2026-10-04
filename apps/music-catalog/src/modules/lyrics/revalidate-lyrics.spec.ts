import {
  type RevalidateRecording,
  revalidateCarriedLyrics,
} from './revalidate-lyrics.js';

const kept = { mbid: 'mbid', plain: 'la', synced: null };

const recording = (
  overrides: Partial<RevalidateRecording> = {},
): RevalidateRecording => ({
  mbid: 'mbid',
  title: 'Carried Song',
  artistNames: ['Carried Singer'],
  lengthMs: 180_000,
  ...overrides,
});

describe('revalidateCarriedLyrics', () => {
  it('keeps Lyrics when the parallel copy describes the same take', () => {
    expect(
      revalidateCarriedLyrics({
        kept,
        before: recording(),
        after: recording(),
      }),
    ).toBe('keep');
  });

  it('ignores spelling the normalization erases', () => {
    expect(
      revalidateCarriedLyrics({
        kept,
        before: recording(),
        after: recording({
          title: 'carried  song!',
          artistNames: ['CARRIED SINGER'],
        }),
      }),
    ).toBe('keep');
  });

  it.each([
    ['a retitled Recording', recording({ title: 'Carried Song (Live)' })],
    ['a re-credited Recording', recording({ artistNames: ['Other Singer'] })],
    [
      'an extra artist',
      recording({ artistNames: ['Carried Singer', 'Guest'] }),
    ],
    ['a lengthless Recording', recording({ lengthMs: null })],
    ['a resized take', recording({ lengthMs: 180_000 + 2001 })],
  ])('drops Lyrics for %s', (_case, after) => {
    expect(revalidateCarriedLyrics({ kept, before: recording(), after })).toBe(
      'drop',
    );
  });

  it('keeps Lyrics within ±2 s of the served length', () => {
    expect(
      revalidateCarriedLyrics({
        kept,
        before: recording(),
        after: recording({ lengthMs: 180_000 - 2000 }),
      }),
    ).toBe('keep');
  });

  it('drops Lyrics when the Recording is gone from the new copy', () => {
    expect(
      revalidateCarriedLyrics({
        kept,
        before: recording(),
        after: undefined,
      }),
    ).toBe('drop');
  });
});
