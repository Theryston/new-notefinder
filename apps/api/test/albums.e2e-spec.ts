import { albumSchema, apiErrorSchema } from '@notefinder/contracts';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createAlbum,
  createArtist,
  createLegacyAlbumId,
  creditAlbumArtist,
} from './utils/factories.js';

// Public album header detail over a real Postgres: the contracted shape with
// its credited artists in MusicBrainz credit order, the legacy-ID fallback
// (`RESOURCE_MOVED` with the new ID versus a real 404) and the header fields
// the page shows, nulls included.
describe('Albums detail (e2e)', () => {
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

  it('returns the album header detail, validated against the contract', async () => {
    const album = await createAlbum(testApp.db, {
      title: 'A Night at the Opera',
      primaryType: 'Album',
      secondaryTypes: ['Live'],
      year: 1975,
      genres: ['rock', 'pop'],
      coverArtUrl:
        'https://coverartarchive.org/release-group/00000000-0000-4000-8000-00000000a001/front-500',
    });

    const response = await testApp.http
      .get(`/v1/albums/${album.id}`)
      .expect(200);

    expect(albumSchema.parse(response.body)).toEqual(response.body);
    expect(response.body).toEqual({
      id: album.id,
      mbid: album.mbid,
      title: 'A Night at the Opera',
      primaryType: 'Album',
      secondaryTypes: ['Live'],
      year: 1975,
      genres: ['rock', 'pop'],
      coverArtUrl: album.coverArtUrl,
      artists: [],
    });
  });

  it('lists the credited artists in credit order, not alphabetically', async () => {
    const album = await createAlbum(testApp.db);
    const queen = await createArtist(testApp.db, { name: 'Queen' });
    const adele = await createArtist(testApp.db, { name: 'Adele' });
    await creditAlbumArtist(testApp.db, album.id, queen.id, 0);
    await creditAlbumArtist(testApp.db, album.id, adele.id, 1);

    const response = await testApp.http
      .get(`/v1/albums/${album.id}`)
      .expect(200);

    expect(albumSchema.parse(response.body)).toEqual(response.body);
    expect(response.body.artists).toEqual([
      { id: queen.id, name: 'Queen' },
      { id: adele.id, name: 'Adele' },
    ]);
  });

  it('returns null header fields and no credits when MusicBrainz has none', async () => {
    const album = await createAlbum(testApp.db, {
      primaryType: null,
      year: null,
      genres: [],
      coverArtUrl: null,
    });

    const response = await testApp.http
      .get(`/v1/albums/${album.id}`)
      .expect(200);

    expect(albumSchema.parse(response.body)).toEqual(response.body);
    expect(response.body).toMatchObject({
      primaryType: null,
      year: null,
      genres: [],
      coverArtUrl: null,
      artists: [],
    });
  });

  it('answers RESOURCE_MOVED with the new ID for a legacy album ID', async () => {
    const album = await createAlbum(testApp.db);
    await createLegacyAlbumId(testApp.db, album.id, 'legacy-album-1');

    const response = await testApp.http
      .get('/v1/albums/legacy-album-1')
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
      .get('/v1/albums/does-not-exist')
      .expect(404);

    expect(apiErrorSchema.parse(response.body)).toEqual(response.body);
    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});
