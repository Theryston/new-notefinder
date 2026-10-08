import {
  SEED_ALBUM_DISCS,
  SEED_ALBUM_TRACKS,
  SEED_ALBUMS,
} from './seed-albums.js';
import { SEED_TRACKS } from './seed-data.js';

describe('seed album tracks', () => {
  it('places every album track on a disc its album has', () => {
    const discs = new Set(
      SEED_ALBUM_DISCS.map((disc) => `${disc.albumId}:${disc.position}`),
    );

    expect(SEED_ALBUM_TRACKS.length).toBeGreaterThan(0);
    for (const track of SEED_ALBUM_TRACKS) {
      expect(discs.has(`${track.albumId}:${track.discPosition}`)).toBe(true);
    }
  });

  it('lists no Track twice on one album', () => {
    const links = SEED_ALBUM_TRACKS.map(
      (track) => `${track.albumId}:${track.trackId}`,
    );

    expect(new Set(links).size).toBe(links.length);
  });

  it('links album tracks only to seeded albums and tracks', () => {
    const albumIds = new Set(SEED_ALBUMS.map((album) => album.id));
    const trackIds = new Set(SEED_TRACKS.map((track) => track.id));

    for (const track of SEED_ALBUM_TRACKS) {
      expect(albumIds.has(track.albumId)).toBe(true);
      expect(trackIds.has(track.trackId)).toBe(true);
    }
  });

  it('gives every seed album at least one Track', () => {
    for (const album of SEED_ALBUMS) {
      const listed = SEED_ALBUM_TRACKS.some(
        (track) => track.albumId === album.id,
      );
      expect(listed).toBe(true);
    }
  });

  it('covers a Track on two albums, a multi-track album and a named disc', () => {
    const albumsOf = (trackId: string) =>
      SEED_ALBUM_TRACKS.filter((track) => track.trackId === trackId).length;
    const tracksOn = (albumId: string) =>
      SEED_ALBUM_TRACKS.filter((track) => track.albumId === albumId).length;

    expect(albumsOf('seedtrack01')).toBeGreaterThan(1);
    expect(SEED_ALBUMS.some((album) => tracksOn(album.id) > 1)).toBe(true);
    expect(
      SEED_ALBUM_DISCS.some((disc) => disc.title !== null && disc.position > 1),
    ).toBe(true);
  });
});
