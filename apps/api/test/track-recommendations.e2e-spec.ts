import { trackRecommendationsSchema } from '@notefinder/contracts';
import request from 'supertest';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createTrack, testMbid } from './utils/factories.js';
import {
  createCompletedTrack,
  createLegacyTrackId,
} from './utils/track-processing-factories.js';

describe('Track recommendations (e2e)', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(app.db);
  });
  const get = (id: string) =>
    request(app.app.getHttpServer()).get(`/v1/tracks/${id}/recommendations`);

  it('prioritizes credited artists, closest range, then trending, excluding itself and unfinished Tracks', async () => {
    const credit = [{ name: 'Queen', mbid: testMbid(900), joinPhrase: '' }];
    const source = await createCompletedTrack(app.db, {
      artistCredit: credit,
      vocalRangeLowest: 60,
      vocalRangeHighest: 72,
      trendingScore: 999,
    });
    const artist = await createCompletedTrack(app.db, {
      artistCredit: credit,
      vocalRangeLowest: 30,
      vocalRangeHighest: 40,
    });
    const near = await createCompletedTrack(app.db, {
      vocalRangeLowest: 61,
      vocalRangeHighest: 73,
    });
    const far = await createCompletedTrack(app.db, {
      vocalRangeLowest: 62,
      vocalRangeHighest: 74,
      trendingScore: 100,
    });
    const trending = await createCompletedTrack(app.db, { trendingScore: 200 });
    await createTrack(app.db, { artistCredit: credit, trendingScore: 9999 });
    const response = await get(source.id).expect(200);
    const { tracks } = trackRecommendationsSchema.parse(response.body);
    expect(tracks.map((track) => track.id)).toEqual([
      artist.id,
      near.id,
      far.id,
      trending.id,
    ]);
    expect(tracks[0]).toMatchObject({
      title: artist.title,
      coverUrl: null,
      artistCredit: [{ name: 'Queen', joinPhrase: '' }],
    });
  });

  it('falls back to trending when artist and range are absent, and caps at seven', async () => {
    const source = await createCompletedTrack(app.db);
    const expected: string[] = [];
    for (let score = 9; score >= 1; score--) {
      const track = await createCompletedTrack(app.db, {
        trendingScore: score,
      });
      expected.push(track.id);
    }
    const response = await get(source.id).expect(200);
    expect(
      trackRecommendationsSchema
        .parse(response.body)
        .tracks.map((track) => track.id),
    ).toEqual(expected.slice(0, 7));
  });

  it('returns an empty list when there are no other completed Tracks', async () => {
    const source = await createCompletedTrack(app.db);
    await createTrack(app.db);
    expect((await get(source.id).expect(200)).body).toEqual({ tracks: [] });
  });

  it('preserves missing and legacy ID semantics', async () => {
    const source = await createCompletedTrack(app.db);
    await createLegacyTrackId(app.db, source.id, 'old-track');
    expect((await get('old-track').expect(404)).body).toMatchObject({
      code: 'RESOURCE_MOVED',
      details: { id: source.id },
    });
    expect((await get('missing-track').expect(404)).body).toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
