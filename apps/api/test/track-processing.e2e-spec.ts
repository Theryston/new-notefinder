import { trackProcessingStateSchema } from '@notefinder/contracts';
import request from 'supertest';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createArtist,
  createPasswordUser,
  createTrack,
  linkTrackArtist,
} from './utils/factories.js';
import {
  createLegacyTrackId,
  createTrackContributor,
  createTrackProcessing,
} from './utils/track-processing-factories.js';

// GET /v1/tracks/:trackId/processing is public: a shared link shows the
// Processing to anyone, and a legacy or unknown ID answers 404 as the other
// catalog routes do.
describe('GET /v1/tracks/:trackId/processing (e2e)', () => {
  let testApp: TestApp;

  const processingOf = (trackId: string) =>
    request(testApp.app.getHttpServer()).get(
      `/v1/tracks/${trackId}/processing`,
    );

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  it('shows the Track and its Processing to anyone, without a session', async () => {
    const track = await createTrack(testApp.db, {
      title: 'Bohemian Rhapsody',
    });
    await createTrackProcessing(testApp.db, track.id);

    const response = await processingOf(track.id).expect(200);

    const state = trackProcessingStateSchema.parse(response.body);
    expect(state).toMatchObject({
      track: {
        id: track.id,
        title: 'Bohemian Rhapsody',
        coverUrl: null,
        artists: [],
      },
      processing: {
        status: 'QUEUED',
        failureCode: null,
        retryable: false,
        resumeFrom: null,
        video: null,
        startedAt: null,
        finishedAt: null,
      },
      contributors: [],
    });
  });

  it('lists the linked Artists of the Track in name order', async () => {
    const track = await createTrack(testApp.db);
    const queen = await createArtist(testApp.db, { name: 'Queen' });
    const abba = await createArtist(testApp.db, { name: 'ABBA' });
    await linkTrackArtist(testApp.db, track.id, queen.id);
    await linkTrackArtist(testApp.db, track.id, abba.id);

    const response = await processingOf(track.id).expect(200);

    expect(response.body.track.artists).toEqual([
      { id: abba.id, name: 'ABBA' },
      { id: queen.id, name: 'Queen' },
    ]);
  });

  it('shows the newest Processing as the Track state', async () => {
    const track = await createTrack(testApp.db);
    await createTrackProcessing(testApp.db, track.id, {
      status: 'FAILED',
      failureCode: 'DOWNLOAD_FAILED',
      resumeFrom: 'DOWNLOADING_AUDIO',
      createdAt: new Date('2026-10-08T12:00:00.000Z'),
    });
    await createTrackProcessing(testApp.db, track.id, {
      status: 'DETECTING_NOTES',
      videoId: 'dQw4w9WgXcQ',
      videoSource: 'musicbrainz',
      createdAt: new Date('2026-10-08T13:00:00.000Z'),
    });

    const response = await processingOf(track.id).expect(200);

    expect(response.body.processing).toMatchObject({
      status: 'DETECTING_NOTES',
      video: { id: 'dQw4w9WgXcQ', source: 'musicbrainz' },
      createdAt: '2026-10-08T13:00:00.000Z',
    });
  });

  it.each([
    ['DOWNLOAD_FAILED', true],
    ['NOTE_DETECTION_FAILED', true],
    ['INTERNAL', true],
    ['VIDEO_NOT_FOUND', false],
    ['TOO_LONG', false],
  ] as const)(
    'marks a %s failure as retryable: %s',
    async (failureCode, retryable) => {
      const track = await createTrack(testApp.db);
      await createTrackProcessing(testApp.db, track.id, {
        status: 'FAILED',
        failureCode,
        resumeFrom: 'FINDING_VIDEO',
        finishedAt: new Date('2026-10-08T12:05:00.000Z'),
      });

      const response = await processingOf(track.id).expect(200);

      expect(response.body.processing).toMatchObject({
        status: 'FAILED',
        failureCode,
        retryable,
        resumeFrom: 'FINDING_VIDEO',
        finishedAt: '2026-10-08T12:05:00.000Z',
      });
    },
  );

  it('lists the Contributors with their Username, Name and Avatar, in the order they contributed', async () => {
    const track = await createTrack(testApp.db);
    const ada = await createPasswordUser(testApp.db, {
      name: 'Ada Lovelace',
      username: 'ada',
      image: 'https://images.example.com/ada.png',
    });
    const grace = await createPasswordUser(testApp.db, {
      name: 'Grace Hopper',
      username: 'grace',
      image: null,
    });
    await createTrackContributor(testApp.db, track.id, ada.id);
    await createTrackContributor(testApp.db, track.id, grace.id);

    const response = await processingOf(track.id).expect(200);

    expect(response.body.contributors).toEqual([
      {
        username: 'ada',
        name: 'Ada Lovelace',
        image: 'https://images.example.com/ada.png',
      },
      { username: 'grace', name: 'Grace Hopper', image: null },
    ]);
  });

  it('shows a Contributor without a Username unlinked, with a null Username', async () => {
    const track = await createTrack(testApp.db);
    const user = await createPasswordUser(testApp.db, { username: null });
    await createTrackContributor(testApp.db, track.id, user.id);

    const response = await processingOf(track.id).expect(200);

    expect(response.body.contributors).toEqual([
      { username: null, name: user.name, image: null },
    ]);
  });

  it('shows a Track that never had a Processing with a null Processing', async () => {
    const track = await createTrack(testApp.db);

    const response = await processingOf(track.id).expect(200);

    expect(response.body).toMatchObject({ processing: null, contributors: [] });
  });

  it('answers a legacy Track ID with 404 RESOURCE_MOVED and the new ID', async () => {
    const track = await createTrack(testApp.db);
    await createLegacyTrackId(testApp.db, track.id, 'clx123abc');

    const response = await processingOf('clx123abc').expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_MOVED',
      details: { id: track.id },
    });
  });

  it('answers an unknown Track ID with 404 NOT_FOUND', async () => {
    const response = await processingOf('no-such-track').expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
