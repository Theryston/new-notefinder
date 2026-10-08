import {
  type CatalogTracksPage,
  catalogTracksPageSchema,
} from '@notefinder/contracts';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createArtist,
  createLegacyArtistId,
  createTrack,
  linkTrackArtist,
} from './utils/factories.js';

const encodeCursor = (id: string): string =>
  Buffer.from(id, 'utf8').toString('base64url');

// Public nested track list over a real Postgres: the contracted
// cursor-paginated shape with one entry per processed Recording, the core
// fields, and the same legacy-ID fallback as the header.
describe('Artist tracks (e2e)', () => {
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

  it('lists the core fields with one entry per track', async () => {
    const artist = await createArtist(testApp.db, { name: 'Queen' });
    const other = await createArtist(testApp.db, { name: 'Other' });
    const first = await createTrack(testApp.db, {
      title: 'Bohemian Rhapsody',
      lengthMs: 354_000,
      disambiguation: '',
      video: false,
      isrcs: ['GBUM71029604'],
      genres: ['rock'],
    });
    const second = await createTrack(testApp.db, {
      title: 'Another One',
      lengthMs: 210_000,
      disambiguation: 'live',
      video: true,
      isrcs: [],
      genres: [],
    });
    const outsider = await createTrack(testApp.db, { title: 'Outsider' });
    await linkTrackArtist(testApp.db, first.id, artist.id);
    await linkTrackArtist(testApp.db, second.id, artist.id);
    await linkTrackArtist(testApp.db, outsider.id, other.id);

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}/tracks`)
      .expect(200);

    const page: CatalogTracksPage = catalogTracksPageSchema.parse(
      response.body,
    );
    expect(page).toEqual(response.body);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(2);
    // Stable `id` order, not creation order: look each track up by ID.
    const byId = new Map(page.items.map((item) => [item.id, item]));
    expect(byId.get(first.id)).toMatchObject({
      id: first.id,
      title: 'Bohemian Rhapsody',
      lengthMs: 354_000,
      isrcs: ['GBUM71029604'],
      genres: ['rock'],
    });
    expect(byId.get(first.id)?.artists).toEqual([
      { id: artist.id, name: 'Queen' },
    ]);
    expect(byId.get(second.id)).toMatchObject({ id: second.id });
  });

  it('paginates with opaque cursors without repeating entries', async () => {
    const artist = await createArtist(testApp.db);
    const made = [];
    for (let index = 0; index < 3; index += 1) {
      const track = await createTrack(testApp.db, {
        title: `Track ${index}`,
      });
      await linkTrackArtist(testApp.db, track.id, artist.id);
      made.push(track);
    }

    const firstResponse = await testApp.http
      .get(`/v1/artists/${artist.id}/tracks?limit=2`)
      .expect(200);
    const first = catalogTracksPageSchema.parse(firstResponse.body);
    expect(first.items).toHaveLength(2);
    expect(typeof first.nextCursor).toBe('string');

    const secondResponse = await testApp.http
      .get(
        `/v1/artists/${artist.id}/tracks?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
      )
      .expect(200);
    const second = catalogTracksPageSchema.parse(secondResponse.body);
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();

    const seen = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(seen).size).toBe(3);
  });

  it('answers an empty page for an artist with no tracks', async () => {
    const artist = await createArtist(testApp.db);

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}/tracks`)
      .expect(200);

    expect(catalogTracksPageSchema.parse(response.body)).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('answers RESOURCE_MOVED with the new ID for a legacy ID', async () => {
    const artist = await createArtist(testApp.db);
    await createLegacyArtistId(testApp.db, artist.id, 'legacy-artist-tracks');

    const response = await testApp.http
      .get('/v1/artists/legacy-artist-tracks/tracks')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_MOVED',
      details: { id: artist.id },
    });
  });

  it('answers a real 404 for an unknown ID', async () => {
    const response = await testApp.http
      .get('/v1/artists/does-not-exist/tracks')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('rejects an invalid cursor with a validation error', async () => {
    const artist = await createArtist(testApp.db);

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}/tracks?cursor=!!!`)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('rejects a raw track ID as a cursor with a validation error', async () => {
    const artist = await createArtist(testApp.db);
    const track = await createTrack(testApp.db, { title: 'Raw' });
    await linkTrackArtist(testApp.db, track.id, artist.id);

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}/tracks?cursor=${track.id}`)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('needs no authentication', async () => {
    const artist = await createArtist(testApp.db);
    const track = await createTrack(testApp.db);
    await linkTrackArtist(testApp.db, track.id, artist.id);

    await testApp.http.get(`/v1/artists/${artist.id}/tracks`).expect(200);
  });

  it('lists every credited artist of a track', async () => {
    const queen = await createArtist(testApp.db, { name: 'Queen' });
    const bowie = await createArtist(testApp.db, { name: 'David Bowie' });
    const track = await createTrack(testApp.db, {
      title: 'Under Pressure',
    });
    await linkTrackArtist(testApp.db, track.id, queen.id);
    await linkTrackArtist(testApp.db, track.id, bowie.id);

    const response = await testApp.http
      .get(`/v1/artists/${queen.id}/tracks`)
      .expect(200);

    const page = catalogTracksPageSchema.parse(response.body);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.artists).toEqual([
      { id: bowie.id, name: 'David Bowie' },
      { id: queen.id, name: 'Queen' },
    ]);
  });

  it('encodes cursors as opaque track IDs', async () => {
    const artist = await createArtist(testApp.db);
    const first = await createTrack(testApp.db, { title: 'First' });
    const second = await createTrack(testApp.db, { title: 'Second' });
    await linkTrackArtist(testApp.db, first.id, artist.id);
    await linkTrackArtist(testApp.db, second.id, artist.id);

    const ids = [first.id, second.id].sort();
    const expected = encodeCursor(ids[0] ?? '');

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}/tracks?limit=1`)
      .expect(200);

    const page = catalogTracksPageSchema.parse(response.body);
    expect(page.nextCursor).toBe(expected);
  });
});
