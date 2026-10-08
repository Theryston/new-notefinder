/**
 * The album track list's page size. The server renders the first page and the
 * client fetches the rest under the same key, so both must agree on it.
 */
export const ALBUM_TRACKS_PAGE_SIZE = 20;

/**
 * TanStack Query keys for the album track grid. One infinite key per album
 * plus page size; the cursor travels as the page param, so every page of one
 * album shares the key and the cache stays per album.
 */
export const albumKeys = {
  all: ['albums'] as const,
  tracks: (albumId: string) => [...albumKeys.all, albumId, 'tracks'] as const,
  infiniteTracks: (albumId: string, limit: number) =>
    [...albumKeys.tracks(albumId), 'infinite', { limit }] as const,
};
