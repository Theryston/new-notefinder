import type { AlbumArtist } from '@notefinder/contracts';

/** How many credited artists the header lists before "and N more". */
export const VISIBLE_ALBUM_ARTISTS = 3;

/**
 * Splits the credited artists, in credit order, into the ones the header
 * always shows and the ones behind the "and N more" control. Compilations
 * can credit dozens of artists, so the header stays compact by default.
 */
export function splitAlbumArtists(
  artists: readonly AlbumArtist[],
  visibleCount = VISIBLE_ALBUM_ARTISTS,
): { visible: AlbumArtist[]; hidden: AlbumArtist[] } {
  return {
    visible: artists.slice(0, visibleCount),
    hidden: artists.slice(visibleCount),
  };
}
