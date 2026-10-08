import {
  type AlbumTracksPage,
  albumSchema,
  albumTracksPageSchema,
  apiErrorSchema,
} from '@notefinder/contracts';
import {
  createAlbumDisc,
  placeAlbumTrack,
} from './utils/album-track-factories.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createAlbum,
  createArtist,
  createLegacyAlbumId,
  createTrack,
  linkTrackArtist,
} from './utils/factories.js';

// Album tracks over a real Postgres: the contracted cursor page in album
// order (disc, then track position), each entry with its disc, the same track
// on two albums, the legacy-ID fallback, and the processed-track count in the
// header detail.
describe('Album tracks (e2e)', () => {
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

  /** A processed Track by a fresh Artist, so it passes the catalog contract. */
  const makeTrack = async (title: string) => {
    const artist = await createArtist(testApp.db);
    const track = await createTrack(testApp.db, { title });
    await linkTrackArtist(testApp.db, track.id, artist.id);
    return track;
  };

  const getPage = async (
    albumId: string,
    query = '',
  ): Promise<AlbumTracksPage> => {
    const response = await testApp.http
      .get(`/v1/albums/${albumId}/tracks${query}`)
      .expect(200);
    const page = albumTracksPageSchema.parse(response.body);
    expect(page).toEqual(response.body);
    return page;
  };

  it('lists the tracks in album order, each with its disc', async () => {
    const album = await createAlbum(testApp.db);
    await createAlbumDisc(testApp.db, album.id, 1, null);
    await createAlbumDisc(testApp.db, album.id, 2, 'Bonus Disc');
    const first = await makeTrack('First');
    const second = await makeTrack('Second');
    const bonus = await makeTrack('Bonus');
    // Inserted out of order on purpose: the listing sorts, not the insert.
    await placeAlbumTrack(testApp.db, {
      albumId: album.id,
      trackId: bonus.id,
      discPosition: 2,
      trackPosition: 1,
    });
    await placeAlbumTrack(testApp.db, {
      albumId: album.id,
      trackId: second.id,
      discPosition: 1,
      trackPosition: 2,
    });
    await placeAlbumTrack(testApp.db, {
      albumId: album.id,
      trackId: first.id,
      discPosition: 1,
      trackPosition: 1,
    });

    const page = await getPage(album.id);

    expect(page.nextCursor).toBeNull();
    expect(page.items.map((item) => item.title)).toEqual([
      'First',
      'Second',
      'Bonus',
    ]);
    expect(page.items.map((item) => item.disc)).toEqual([
      { position: 1, title: null },
      { position: 1, title: null },
      { position: 2, title: 'Bonus Disc' },
    ]);
  });

  it('pages across disc boundaries without repeating or skipping', async () => {
    const album = await createAlbum(testApp.db);
    await createAlbumDisc(testApp.db, album.id, 1, null);
    await createAlbumDisc(testApp.db, album.id, 2, 'Bonus Disc');
    const places: [string, number, number][] = [
      ['A', 1, 1],
      ['B', 1, 2],
      ['C', 1, 3],
      ['D', 2, 1],
      ['E', 2, 2],
    ];
    for (const [title, discPosition, trackPosition] of places) {
      const track = await makeTrack(title);
      await placeAlbumTrack(testApp.db, {
        albumId: album.id,
        trackId: track.id,
        discPosition,
        trackPosition,
      });
    }

    const first = await getPage(album.id, '?limit=2');
    expect(first.items.map((item) => item.title)).toEqual(['A', 'B']);
    expect(first.nextCursor).not.toBeNull();

    const second = await getPage(
      album.id,
      `?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    expect(second.items.map((item) => item.title)).toEqual(['C', 'D']);
    expect(second.items.map((item) => item.disc.position)).toEqual([1, 2]);

    const last = await getPage(
      album.id,
      `?limit=2&cursor=${encodeURIComponent(second.nextCursor ?? '')}`,
    );
    expect(last.items.map((item) => item.title)).toEqual(['E']);
    expect(last.nextCursor).toBeNull();
  });

  it('lists a track on two albums on each, at its place on each', async () => {
    const studio = await createAlbum(testApp.db, { title: 'Studio' });
    const compilation = await createAlbum(testApp.db, {
      title: 'Compilation',
    });
    await createAlbumDisc(testApp.db, studio.id, 1, null);
    await createAlbumDisc(testApp.db, compilation.id, 1, null);
    await createAlbumDisc(testApp.db, compilation.id, 2, 'Bonus Disc');
    const shared = await makeTrack('Shared');
    const other = await makeTrack('Other');
    await placeAlbumTrack(testApp.db, {
      albumId: studio.id,
      trackId: shared.id,
      discPosition: 1,
      trackPosition: 1,
    });
    await placeAlbumTrack(testApp.db, {
      albumId: compilation.id,
      trackId: other.id,
      discPosition: 1,
      trackPosition: 1,
    });
    await placeAlbumTrack(testApp.db, {
      albumId: compilation.id,
      trackId: shared.id,
      discPosition: 2,
      trackPosition: 3,
    });

    const studioPage = await getPage(studio.id);
    const compilationPage = await getPage(compilation.id);

    expect(studioPage.items.map((item) => item.id)).toEqual([shared.id]);
    expect(studioPage.items[0]?.disc).toEqual({ position: 1, title: null });
    expect(compilationPage.items.map((item) => item.id)).toEqual([
      other.id,
      shared.id,
    ]);
    expect(compilationPage.items[1]?.disc).toEqual({
      position: 2,
      title: 'Bonus Disc',
    });
  });

  it('answers an empty page for an album with no tracks', async () => {
    const album = await createAlbum(testApp.db);

    const page = await getPage(album.id);

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('answers RESOURCE_MOVED with the new ID for a legacy album ID', async () => {
    const album = await createAlbum(testApp.db);
    await createLegacyAlbumId(testApp.db, album.id, 'legacy-album-tracks');

    const response = await testApp.http
      .get('/v1/albums/legacy-album-tracks/tracks')
      .expect(404);

    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_MOVED',
      details: { id: album.id },
    });
  });

  it('answers a real NOT_FOUND for an ID that is neither an album nor legacy', async () => {
    const response = await testApp.http
      .get('/v1/albums/does-not-exist/tracks')
      .expect(404);

    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    expect(response.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('rejects a cursor this API did not issue', async () => {
    const album = await createAlbum(testApp.db);

    const response = await testApp.http
      .get(`/v1/albums/${album.id}/tracks?cursor=raw-track-id`)
      .expect(400);

    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('counts the processed tracks in the header detail', async () => {
    const album = await createAlbum(testApp.db);
    await createAlbumDisc(testApp.db, album.id, 1);
    const one = await makeTrack('One');
    const two = await makeTrack('Two');
    await placeAlbumTrack(testApp.db, {
      albumId: album.id,
      trackId: one.id,
      discPosition: 1,
      trackPosition: 1,
    });
    await placeAlbumTrack(testApp.db, {
      albumId: album.id,
      trackId: two.id,
      discPosition: 1,
      trackPosition: 2,
    });

    const response = await testApp.http
      .get(`/v1/albums/${album.id}`)
      .expect(200);

    expect(albumSchema.parse(response.body)).toEqual(response.body);
    expect(response.body).toMatchObject({ trackCount: 2 });
  });

  it('counts zero tracks for an album with none yet', async () => {
    const album = await createAlbum(testApp.db);

    const response = await testApp.http
      .get(`/v1/albums/${album.id}`)
      .expect(200);

    expect(response.body).toMatchObject({ trackCount: 0 });
  });
});
