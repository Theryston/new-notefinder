import { artistSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import { artists, legacyArtistIds } from '../src/database/schema/artists.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createArtist,
  createLegacyArtistId,
  linkTrackArtist,
} from './utils/factories.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

// Public artist header detail over a real Postgres: the contracted shape
// with its track count, the legacy-ID fallback (`RESOURCE_MOVED` with the
// new ID versus a real 404), and cascade cleanup of the map entries.
describe('Artists detail (e2e)', () => {
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

  it('returns the artist header detail with its track count', async () => {
    const artist = await createArtist(testApp.db, {
      name: 'Queen',
      genres: ['rock', 'pop'],
    });
    const first = await createCompletedTrack(testApp.db);
    const second = await createCompletedTrack(testApp.db);
    await linkTrackArtist(testApp.db, first.id, artist.id);
    await linkTrackArtist(testApp.db, second.id, artist.id);

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}`)
      .expect(200);

    expect(artistSchema.parse(response.body)).toEqual(response.body);
    expect(response.body).toMatchObject({
      id: artist.id,
      mbid: artist.mbid,
      name: 'Queen',
      genres: ['rock', 'pop'],
      trackCount: 2,
    });
  });

  it('answers NOT_FOUND for an artist with no completed Track', async () => {
    const artist = await createArtist(testApp.db, { genres: [] });

    const response = await testApp.http
      .get(`/v1/artists/${artist.id}`)
      .expect(404);

    expect(response.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('needs no authentication', async () => {
    const artist = await createArtist(testApp.db);
    const track = await createCompletedTrack(testApp.db);
    await linkTrackArtist(testApp.db, track.id, artist.id);

    await testApp.http.get(`/v1/artists/${artist.id}`).expect(200);
  });

  it('answers RESOURCE_MOVED with the new ID for a legacy ID', async () => {
    const artist = await createArtist(testApp.db);
    await createLegacyArtistId(testApp.db, artist.id, 'legacy-artist-1');

    const response = await testApp.http
      .get('/v1/artists/legacy-artist-1')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_MOVED',
      details: { id: artist.id },
    });
  });

  it('answers a real 404 for an unknown ID', async () => {
    const response = await testApp.http
      .get('/v1/artists/does-not-exist')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('removes the legacy map entry with its artist', async () => {
    const artist = await createArtist(testApp.db);
    await createLegacyArtistId(testApp.db, artist.id, 'legacy-artist-1');

    await testApp.db.delete(artists).where(eq(artists.id, artist.id));

    await expect(testApp.db.select().from(legacyArtistIds)).resolves.toEqual(
      [],
    );
  });
});
