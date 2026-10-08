/**
 * TanStack Query keys for the artist track grid. One infinite key per
 * artist plus page size; the cursor travels as the page param, so every
 * page of one artist shares the key and the cache stays per artist.
 */
export const artistKeys = {
  all: ['artists'] as const,
  tracks: (artistId: string) =>
    [...artistKeys.all, artistId, 'tracks'] as const,
  infiniteTracks: (artistId: string, limit: number) =>
    [...artistKeys.tracks(artistId), 'infinite', { limit }] as const,
};
