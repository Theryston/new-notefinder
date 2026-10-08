import { describe, expect, it } from 'vitest';

import { splitAlbumArtists, VISIBLE_ALBUM_ARTISTS } from './album-artists';

const credit = (n: number) => ({ id: `artist-${n}`, name: `Artist ${n}` });

describe('splitAlbumArtists', () => {
  it('shows the first three artists and hides the rest, in credit order', () => {
    const artists = [1, 2, 3, 4, 5].map(credit);

    const { visible, hidden } = splitAlbumArtists(artists);

    expect(VISIBLE_ALBUM_ARTISTS).toBe(3);
    expect(visible).toEqual(artists.slice(0, 3));
    expect(hidden).toEqual(artists.slice(3));
  });

  it('hides nothing when there are three artists or fewer', () => {
    const artists = [1, 2].map(credit);

    expect(splitAlbumArtists(artists)).toEqual({
      visible: artists,
      hidden: [],
    });
  });

  it('hides nothing for an album without artists', () => {
    expect(splitAlbumArtists([])).toEqual({ visible: [], hidden: [] });
  });

  it('takes the visible count as an option', () => {
    const artists = [1, 2, 3].map(credit);

    expect(splitAlbumArtists(artists, 1)).toEqual({
      visible: [credit(1)],
      hidden: [credit(2), credit(3)],
    });
  });
});
