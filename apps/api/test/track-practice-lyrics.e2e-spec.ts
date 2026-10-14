import { trackLyricsSchema } from '@notefinder/contracts';
import request from 'supertest';
import {
  trackLyricLines,
  trackLyricWords,
} from '../src/database/schema/track-lyrics.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createTrack } from './utils/factories.js';
import { createLegacyTrackId } from './utils/track-processing-factories.js';

// GET /v1/tracks/:trackId/lyrics is public like the rest of the practice reads:
// the page is shared and indexed, and a legacy or unknown ID answers 404.
describe('Track Timed lyrics read (e2e)', () => {
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

  const insertLine = async (
    trackId: string,
    position: number,
    words: { text: string; start: number; end: number }[],
  ) => {
    const [line] = await testApp.db
      .insert(trackLyricLines)
      .values({
        trackId,
        position,
        start: words[0]?.start ?? 0,
        end: words.at(-1)?.end ?? 0,
      })
      .returning();
    if (line === undefined) throw new Error('the line was not inserted');
    await testApp.db.insert(trackLyricWords).values(
      words.map((word, wordPosition) => ({
        trackId,
        lineId: line.id,
        position: wordPosition,
        ...word,
      })),
    );
  };

  it('lists the lines with their words in the order they are sung, to anyone', async () => {
    const track = await createTrack(testApp.db);
    // Inserted out of order: positions decide.
    await insertLine(track.id, 1, [{ text: 'Mamma', start: 12.5, end: 13 }]);
    await insertLine(track.id, 0, [
      { text: 'Is', start: 1, end: 1.5 },
      { text: 'this', start: 1.5, end: 2 },
    ]);

    const response = await get(`${track.id}/lyrics`).expect(200);

    expect(trackLyricsSchema.parse(response.body)).toEqual({
      lines: [
        {
          start: 1,
          end: 2,
          words: [
            { text: 'Is', start: 1, end: 1.5 },
            { text: 'this', start: 1.5, end: 2 },
          ],
        },
        {
          start: 12.5,
          end: 13,
          words: [{ text: 'Mamma', start: 12.5, end: 13 }],
        },
      ],
    });
  });

  it('answers no lines for a Track without Timed lyrics', async () => {
    const track = await createTrack(testApp.db);

    const response = await get(`${track.id}/lyrics`).expect(200);

    expect(response.body).toEqual({ lines: [] });
  });

  it('answers a legacy Track ID with 404 RESOURCE_MOVED and the new ID', async () => {
    const track = await createTrack(testApp.db);
    await createLegacyTrackId(testApp.db, track.id, 'clx123abc');

    const response = await get('clx123abc/lyrics').expect(404);

    expect(response.body).toMatchObject({
      code: 'RESOURCE_MOVED',
      details: { id: track.id },
    });
  });

  it('answers a Track ID that is too long with 400 VALIDATION_FAILED', async () => {
    const response = await get(`${'x'.repeat(129)}/lyrics`).expect(400);

    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { location: 'param' },
    });
  });

  it('answers an unknown Track ID with 404 NOT_FOUND', async () => {
    const response = await get('no-such-track/lyrics').expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
