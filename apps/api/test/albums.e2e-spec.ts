import { albumSchema, trackSummaryPageSchema } from '@notefinder/contracts';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { type Album, createAlbum, createTrack } from './utils/factories.js';

// Paging, ordering and the track card shape are shared with the artist
// routes (TracksService) and covered in artists.e2e-spec.ts.
describe('albums (e2e)', () => {
  let testApp: TestApp;
  let album: Album;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    album = await createAlbum(testApp.db, { name: 'Acústico' });
  });

  describe('GET /v1/albums/:albumId', () => {
    it('returns the album with its completed tracks count, signed out', async () => {
      await createTrack(testApp.db, { album });
      await createTrack(testApp.db, { album, track: { status: 'QUEUED' } });
      await createTrack(testApp.db);

      const response = await testApp.http.get(`/v1/albums/${album.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: album.id,
        name: 'Acústico',
        trackCount: 1,
      });
      expect(albumSchema.parse(response.body)).toEqual(response.body);
    });

    it('answers 404 for an unknown ID', async () => {
      const response = await testApp.http.get('/v1/albums/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('GET /v1/albums/:albumId/tracks', () => {
    it('pages through the completed tracks of the album only', async () => {
      const top = await createTrack(testApp.db, { album, track: { score: 9 } });
      const next = await createTrack(testApp.db, {
        album,
        track: { score: 5 },
      });
      await createTrack(testApp.db, {
        album,
        track: { score: 7, status: 'ERROR' },
      });
      await createTrack(testApp.db, { track: { score: 8 } });

      const first = await testApp.http
        .get(`/v1/albums/${album.id}/tracks`)
        .query({ limit: 1 });
      const firstPage = trackSummaryPageSchema.parse(first.body);
      const second = await testApp.http
        .get(`/v1/albums/${album.id}/tracks`)
        .query({ limit: 1, cursor: firstPage.nextCursor ?? '' });
      const secondPage = trackSummaryPageSchema.parse(second.body);

      expect(first.status).toBe(200);
      expect(firstPage.items.map((item) => item.id)).toEqual([top.track.id]);
      expect(firstPage.items[0]?.album).toEqual({
        id: album.id,
        name: 'Acústico',
      });
      expect(secondPage.items.map((item) => item.id)).toEqual([next.track.id]);
      expect(secondPage.nextCursor).toBeNull();
    });

    it('answers 400 for an invalid limit or cursor', async () => {
      const badLimit = await testApp.http
        .get(`/v1/albums/${album.id}/tracks`)
        .query({ limit: 0 });
      const badCursor = await testApp.http
        .get(`/v1/albums/${album.id}/tracks`)
        .query({ cursor: 'garbage' });

      expect(badLimit.status).toBe(400);
      expect(badLimit.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(badCursor.status).toBe(400);
      expect(badCursor.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('answers 404 for an unknown ID', async () => {
      const response = await testApp.http.get('/v1/albums/unknown/tracks');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
