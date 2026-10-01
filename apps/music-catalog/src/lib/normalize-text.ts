/**
 * Normalizes a title, artist or album name for Lyrics matching: case, accents
 * and punctuation are spelling noise (LRCLIB and MusicBrainz spell the same
 * song differently), while extra words are not (a "(Live)" take must never
 * match the studio one, so they are kept as words, not stripped). Letters of
 * every script are kept, so two different non-Latin titles never normalize to
 * the same empty text.
 */
export const normalizeLyricsText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
