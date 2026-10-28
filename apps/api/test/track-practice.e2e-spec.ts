import { trackDetailSchema, trackNotesSchema } from '@vozzify/contracts';
import request from 'supertest';
import { trackNotes } from '../src/database/schema/track-notes.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createArtist,
  createPasswordUser,
  createTrack,
  linkTrackArtist,
  testMbid,
} from './utils/factories.js';
import {
  createLegacyTrackId,
  createTrackContributor,
} from './utils/track-processing-factories.js';

// GET /v1/tracks/:trackId and GET /v1/tracks/:trackId/notes are public: the
// practice page is shared and indexed, and a legacy or unknown ID answers 404
// as the other catalog routes do.
describe('Track practice reads (e2e)', () => {
  let testApp: TestApp;

  const get = (path: string) =>
    request(testApp.app.getHttpServer()).get(`/v1/tracks/${path}`);

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  describe('GET /v1/tracks/:trackId', () => {
    it('shows the header to anyone, without a session', async () => {
      // The credit prints "Queen" for an Artist named otherwise, so only the
      // MBID can link them.
      const queen = await createArtist(testApp.db, { name: 'Queen (band)' });
      const track = await createTrack(testApp.db, {
        title: 'Under Pressure',
        lengthMs: 248_000,
        coverUrl: 'https://images.example.com/cover.webp',
        youtubeVideoId: 'a01QQZyl-_I',
        artistCredit: [
          { name: 'Queen', joinPhrase: ' & ', mbid: queen.mbid },
          // Not linked to the Track: no Artist page.
          { name: 'David Bowie', joinPhrase: '', mbid: testMbid(999) },
        ],
      });
      await linkTrackArtist(testApp.db, track.id, queen.id);
      const ada = await createPasswordUser(testApp.db, {
        name: 'Ada Lovelace',
        username: 'ada',
      });
      const contributor = await createTrackContributor(
        testApp.db,
        track.id,
        ada.id,
      );
      await testApp.db.insert(trackNotes).values({
        trackId: track.id,
        pitch: 62,
        start: 1,
        end: 2,
      });

      const response = await get(track.id).expect(200);

      // The MBID that links a name to its Artist is internal.
      expect(JSON.stringify(response.body)).not.toContain('mbid');
      expect(trackDetailSchema.parse(response.body)).toEqual({
        id: track.id,
        title: 'Under Pressure',
        coverUrl: 'https://images.example.com/cover.webp',
        artistCredit: [
          { name: 'Queen', joinPhrase: ' & ', artistId: queen.id },
          { name: 'David Bowie', joinPhrase: '', artistId: null },
        ],
        durationMs: 248_000,
        youtubeVideoId: 'a01QQZyl-_I',
        contributors: [
          {
            id: contributor.id,
            username: 'ada',
            name: 'Ada Lovelace',
            image: null,
          },
        ],
        contributorCount: 1,
        hasNotes: true,
        viewCount: 0,
      });
    });

    it('says a Track without vocal notes has none', async () => {
      const track = await createTrack(testApp.db, {
        lengthMs: null,
        youtubeVideoId: null,
      });

      const response = await get(track.id).expect(200);

      expect(response.body).toMatchObject({
        hasNotes: false,
        durationMs: null,
        youtubeVideoId: null,
      });
    });

    it('answers a legacy Track ID with 404 RESOURCE_MOVED and the new ID', async () => {
      const track = await createTrack(testApp.db);
      await createLegacyTrackId(testApp.db, track.id, 'clx123abc');

      const response = await get('clx123abc').expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_MOVED',
        details: { id: track.id },
      });
    });

    it('answers an unknown Track ID with 404 NOT_FOUND', async () => {
      const response = await get('no-such-track').expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('GET /v1/tracks/:trackId/notes', () => {
    it('lists the notes in the order they are sung', async () => {
      const track = await createTrack(testApp.db);
      await testApp.db.insert(trackNotes).values([
        {
          trackId: track.id,
          pitch: 64.2,
          start: 5,
          end: 6.5,
        },
        {
          trackId: track.id,
          pitch: 49,
          start: 1.25,
          end: 2,
        },
      ]);

      const response = await get(`${track.id}/notes`).expect(200);

      expect(trackNotesSchema.parse(response.body)).toEqual({
        notes: [
          { pitch: 49, start: 1.25, end: 2 },
          { pitch: 64.2, start: 5, end: 6.5 },
        ],
      });
    });

    it('answers an empty list for a Track without vocal notes', async () => {
      const track = await createTrack(testApp.db);

      const response = await get(`${track.id}/notes`).expect(200);

      expect(response.body).toEqual({ notes: [] });
    });

    it('answers a legacy Track ID with 404 RESOURCE_MOVED and the new ID', async () => {
      const track = await createTrack(testApp.db);
      await createLegacyTrackId(testApp.db, track.id, 'clx123abc');

      const response = await get('clx123abc/notes').expect(404);

      expect(response.body).toMatchObject({
        code: 'RESOURCE_MOVED',
        details: { id: track.id },
      });
    });

    it('answers an unknown Track ID with 404 NOT_FOUND', async () => {
      const response = await get('no-such-track/notes').expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
