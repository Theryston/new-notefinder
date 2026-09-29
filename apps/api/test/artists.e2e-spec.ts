import { artistSchema, trackSummaryPageSchema } from '@notefinder/contracts';
import { eq, sql } from 'drizzle-orm';
import { tracks } from '../src/database/schema/tracks.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  type Artist,
  createAlbum,
  createArtist,
  createTrack,
} from './utils/factories.js';

const notFound = {
  statusCode: 404,
  code: 'NOT_FOUND',
  message: 'Artist not found',
};

describe('artists (e2e)', () => {
  let testApp: TestApp;
  let artist: Artist;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    artist = await createArtist(testApp.db, { name: 'Ana Castela' });
  });

  const listTracks = (query: Record<string, string | number> = {}) =>
    testApp.http.get(`/v1/artists/${artist.id}/tracks`).query(query);

  const idsOf = (body: unknown) =>
    trackSummaryPageSchema.parse(body).items.map((item) => item.id);

  describe('GET /v1/artists/:artistId', () => {
    it('returns the artist with its completed tracks count, signed out', async () => {
      await createTrack(testApp.db, { artists: [artist] });
      await createTrack(testApp.db, { artists: [artist] });
      await createTrack(testApp.db, {
        artists: [artist],
        track: { status: 'DETECTING_VOCALS_NOTES' },
      });
      await createTrack(testApp.db);

      const response = await testApp.http.get(`/v1/artists/${artist.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: artist.id,
        name: 'Ana Castela',
        trackCount: 2,
      });
      expect(artistSchema.parse(response.body)).toEqual(response.body);
    });

    it('answers 404 for an unknown ID', async () => {
      const response = await testApp.http.get('/v1/artists/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toEqual(notFound);
    });
  });

  describe('GET /v1/artists/:artistId/tracks', () => {
    it('returns the track cards of the artist', async () => {
      const album = await createAlbum(testApp.db, { name: 'Boiadeira' });
      const featured = await createArtist(testApp.db, { name: 'Zé Neto' });
      const { track } = await createTrack(testApp.db, {
        artists: [artist, featured],
        album,
        track: { title: 'Pipoco', durationSeconds: 150 },
        thumbnails: [
          { url: 'https://img.example/544.jpg', width: 544, height: 544 },
          { url: 'https://img.example/60.jpg', width: 60, height: 60 },
        ],
        notes: [
          { note: 'A', octave: 4, frequencyMean: 440 },
          { note: 'E', octave: 2, frequencyMean: 82.4 },
          { note: 'C', octave: 3, frequencyMean: 130.8 },
        ],
      });

      const response = await listTracks();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        items: [
          {
            id: track.id,
            title: 'Pipoco',
            durationSeconds: 150,
            artists: expect.arrayContaining([
              { id: artist.id, name: 'Ana Castela' },
              { id: featured.id, name: 'Zé Neto' },
            ]),
            album: { id: album.id, name: 'Boiadeira' },
            thumbnails: [
              { url: 'https://img.example/60.jpg', width: 60, height: 60 },
              { url: 'https://img.example/544.jpg', width: 544, height: 544 },
            ],
            vocalRange: {
              lowest: { note: 'E', octave: 2 },
              highest: { note: 'A', octave: 4 },
            },
          },
        ],
        nextCursor: null,
      });
      expect(response.body.items[0].artists).toHaveLength(2);
      expect(trackSummaryPageSchema.parse(response.body)).toEqual(
        response.body,
      );
    });

    it('keeps legacy nulls: no title, album, cover or notes', async () => {
      const { track } = await createTrack(testApp.db, {
        artists: [artist],
        track: { title: null, durationSeconds: null },
        thumbnails: [],
      });

      const response = await listTracks();

      expect(response.body.items).toEqual([
        {
          id: track.id,
          title: null,
          durationSeconds: null,
          artists: [{ id: artist.id, name: 'Ana Castela' }],
          album: null,
          thumbnails: [],
          vocalRange: null,
        },
      ]);
    });

    it('lists only completed tracks of this artist, most popular first', async () => {
      const low = await createTrack(testApp.db, {
        artists: [artist],
        track: { score: 1 },
      });
      const high = await createTrack(testApp.db, {
        artists: [artist],
        track: { score: 10 },
      });
      await createTrack(testApp.db, {
        artists: [artist],
        track: { score: 99, status: 'ERROR' },
      });
      await createTrack(testApp.db, { track: { score: 50 } });

      const response = await listTracks();

      expect(idsOf(response.body)).toEqual([high.track.id, low.track.id]);
    });

    it('walks every page with the cursor, without gaps or repeats', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.123456Z');
      const created: string[] = [];
      for (const score of [3, 2, 2, 2, 1]) {
        const { track } = await createTrack(testApp.db, {
          artists: [artist],
          // Ties on score and on createdAt fall back to the ID.
          track: { score, createdAt },
        });
        created.push(track.id);
      }

      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const response = await listTracks({
          limit: 2,
          ...(cursor ? { cursor } : {}),
        });
        expect(response.status).toBe(200);
        const page = trackSummaryPageSchema.parse(response.body);
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
        pages += 1;
      } while (cursor !== null);

      expect(pages).toBe(3);
      expect(seen).toHaveLength(5);
      expect(new Set(seen)).toEqual(new Set(created));
      expect(seen[0]).toBe(created[0]);
      expect(seen[4]).toBe(created[4]);
    });

    it('orders ties on score by newest first, to the microsecond', async () => {
      // One microsecond apart: a cursor holding a JS Date (milliseconds)
      // would skip or repeat one of them.
      const createdAt = async (trackId: string, micros: string) => {
        await testApp.db
          .update(tracks)
          .set({
            createdAt: sql`${`2026-01-01 00:00:00.000${micros}+00`}::timestamptz`,
          })
          .where(eq(tracks.id, trackId));
      };
      const older = await createTrack(testApp.db, { artists: [artist] });
      const newer = await createTrack(testApp.db, { artists: [artist] });
      await createdAt(older.track.id, '001');
      await createdAt(newer.track.id, '002');

      const first = await listTracks({ limit: 1 });
      const second = await listTracks({
        limit: 1,
        cursor: first.body.nextCursor,
      });

      expect(idsOf(first.body)).toEqual([newer.track.id]);
      expect(idsOf(second.body)).toEqual([older.track.id]);
      expect(second.body.nextCursor).toBeNull();
    });

    it('answers 400 for a cursor it did not make', async () => {
      const response = await listTracks({ cursor: 'garbage' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: {
          location: 'query',
          issues: [expect.objectContaining({ path: ['cursor'] })],
        },
      });
    });

    it.each([0, 101, 'abc'])('answers 400 for limit=%s', async (limit) => {
      const response = await listTracks({ limit });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { location: 'query' },
      });
    });

    it('answers 404 for an unknown ID', async () => {
      const response = await testApp.http.get('/v1/artists/unknown/tracks');

      expect(response.status).toBe(404);
      expect(response.body).toEqual(notFound);
    });
  });
});
