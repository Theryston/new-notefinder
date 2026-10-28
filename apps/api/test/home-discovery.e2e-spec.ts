import type { HomeRow } from '@vozzify/contracts';
import request from 'supertest';
import {
  createAlbumDisc,
  placeAlbumTrack,
} from './utils/album-track-factories.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createAlbum,
  createArtist,
  createTrack,
  linkTrackArtist,
} from './utils/factories.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

const getHome = (testApp: TestApp) =>
  request(testApp.app.getHttpServer()).get('/v1/home');

const rowOf = (body: { rows: HomeRow[] }, id: string): HomeRow | undefined =>
  body.rows.find((row) => row.id === id);

/** Six serviced genres: each tile's genre names three completed Tracks. */
const GENRES = [
  'blues',
  'country',
  'disco',
  'funk',
  'jazz',
  'pop',
  'rock',
  'soul',
];

/**
 * A catalog rich enough for every discovery row: 24 completed Tracks (three
 * per genre, hottest first), six Artists on two Tracks each and six Albums
 * on one Track each, every Track covered and scored.
 */
const seedDiscoveryCatalog = async (testApp: TestApp) => {
  const tracks = [];
  for (let i = 0; i < 24; i += 1) {
    tracks.push(
      await createCompletedTrack(testApp.db, {
        title: `Discovery track ${i}`,
        coverUrl: `https://cdn.example/discovery-${i}.webp`,
        genres: [GENRES[i % GENRES.length] ?? 'rock'],
        trendingScore: 100 - i,
      }),
    );
  }
  const artists = [];
  for (let j = 0; j < 6; j += 1) {
    const artist = await createArtist(testApp.db, {
      name: `Discovery artist ${j}`,
    });
    const first = tracks[j];
    const second = tracks[j + 6];
    if (first) await linkTrackArtist(testApp.db, first.id, artist.id);
    if (second) await linkTrackArtist(testApp.db, second.id, artist.id);
    artists.push(artist);
  }
  const albums = [];
  for (let k = 0; k < 6; k += 1) {
    const album = await createAlbum(testApp.db, {
      title: `Discovery album ${k}`,
      coverArtUrl: `https://cdn.example/discovery-album-${k}.webp`,
      year: 2000 + k,
    });
    await createAlbumDisc(testApp.db, album.id, 1);
    const placed = tracks[k];
    if (placed) {
      await placeAlbumTrack(testApp.db, {
        albumId: album.id,
        trackId: placed.id,
        discPosition: 1,
        trackPosition: k + 1,
      });
    }
    albums.push(album);
  }
  return { tracks, artists, albums };
};

describe('Home discovery rows (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  it('serves the genre tiles, featured artists and featured albums rows', async () => {
    await seedDiscoveryCatalog(testApp);

    const { body } = await getHome(testApp).expect(200);

    expect(body.rows.map((row: HomeRow) => row.id)).toEqual([
      'hero',
      'trending-today',
      'new-tracks',
      'genres',
      'featured-artists',
      'featured-albums',
    ]);
    expect(body.nextCursor).toBeNull();

    const genres = rowOf(body, 'genres');
    expect(genres).toEqual({
      id: 'genres',
      layout: 'genres',
      title: { key: 'home.rows.genres', params: {} },
      items: [...GENRES].sort().map((name) => ({ name })),
    });

    const artists = rowOf(body, 'featured-artists');
    expect(artists).toEqual({
      id: 'featured-artists',
      layout: 'artists',
      title: { key: 'home.rows.featuredArtists', params: {} },
      items: Array.from({ length: 6 }, (_, j) => ({
        id: expect.any(String),
        name: `Discovery artist ${j}`,
      })),
    });

    const albums = rowOf(body, 'featured-albums');
    expect(albums).toEqual({
      id: 'featured-albums',
      layout: 'albums',
      title: { key: 'home.rows.featuredAlbums', params: {} },
      items: Array.from({ length: 6 }, (_, k) => ({
        id: expect.any(String),
        title: `Discovery album ${k}`,
        coverArtUrl: `https://cdn.example/discovery-album-${k}.webp`,
        year: 2000 + k,
      })),
    });

    for (const row of body.rows as HomeRow[]) {
      expect(row).not.toHaveProperty('sponsored');
    }
  });

  it('hides the genre tiles when fewer than six genres qualify', async () => {
    for (let i = 0; i < 15; i += 1) {
      await createCompletedTrack(testApp.db, {
        title: `Thin track ${i}`,
        genres: [`thin-genre-${i % 5}`],
        trendingScore: 50 - i,
      });
    }

    const { body } = await getHome(testApp).expect(200);

    expect(rowOf(body, 'genres')).toBeUndefined();
    expect(rowOf(body, 'featured-artists')).toBeUndefined();
    expect(rowOf(body, 'featured-albums')).toBeUndefined();
  });

  it('lists only genres with enough completed Tracks', async () => {
    for (let i = 0; i < 18; i += 1) {
      await createCompletedTrack(testApp.db, {
        title: `Genre track ${i}`,
        genres: [`solid-genre-${i % 6}`],
      });
    }
    await createCompletedTrack(testApp.db, {
      title: 'Rare one',
      genres: ['rare-genre'],
    });
    await createCompletedTrack(testApp.db, {
      title: 'Rare two',
      genres: ['rare-genre'],
    });

    const { body } = await getHome(testApp).expect(200);

    const genres = rowOf(body, 'genres');
    expect(genres?.layout).toBe('genres');
    if (genres?.layout === 'genres') {
      expect(genres.items.map((item) => item.name).sort()).toEqual(
        Array.from({ length: 6 }, (_, i) => `solid-genre-${i}`),
      );
    }
  });

  it('shows only artists with a completed Track', async () => {
    const played = await createArtist(testApp.db, { name: 'Played artist' });
    const finished = await createCompletedTrack(testApp.db, {
      title: 'Finished song',
    });
    await linkTrackArtist(testApp.db, finished.id, played.id);
    const silent = await createArtist(testApp.db, { name: 'Silent artist' });
    const unfinished = await createTrack(testApp.db, { title: 'Unfinished' });
    await linkTrackArtist(testApp.db, unfinished.id, silent.id);

    const { body } = await getHome(testApp).expect(200);

    // One artist cannot fill a row: the row stays hidden instead of half shown.
    expect(rowOf(body, 'featured-artists')).toBeUndefined();
  });

  it('shows only albums with a completed Track', async () => {
    const ready = await createAlbum(testApp.db, { title: 'Ready album' });
    await createAlbumDisc(testApp.db, ready.id, 1);
    const finished = await createCompletedTrack(testApp.db, {
      title: 'Finished song',
    });
    await placeAlbumTrack(testApp.db, {
      albumId: ready.id,
      trackId: finished.id,
      discPosition: 1,
      trackPosition: 1,
    });
    const empty = await createAlbum(testApp.db, { title: 'Empty album' });
    await createAlbumDisc(testApp.db, empty.id, 1);
    const unfinished = await createTrack(testApp.db, { title: 'Unfinished' });
    await placeAlbumTrack(testApp.db, {
      albumId: empty.id,
      trackId: unfinished.id,
      discPosition: 1,
      trackPosition: 1,
    });

    const { body } = await getHome(testApp).expect(200);

    // One album cannot fill a row: the row stays hidden instead of half shown.
    expect(rowOf(body, 'featured-albums')).toBeUndefined();
  });
});
