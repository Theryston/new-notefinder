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

describe('Track Timed lyrics (e2e)', () => {
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

  it('lists Timed lyric lines and words in sung order', async () => {
    const track = await createTrack(testApp.db);
    const [laterLine, earlierLine] = await testApp.db
      .insert(trackLyricLines)
      .values([
        { trackId: track.id, position: 1, start: 2, end: 4 },
        { trackId: track.id, position: 0, start: 0, end: 2 },
      ])
      .returning();
    if (!laterLine || !earlierLine) throw new Error('expected lyric lines');
    await testApp.db.insert(trackLyricWords).values([
      {
        trackId: track.id,
        lineId: laterLine.id,
        position: 0,
        text: 'world',
        start: 2.5,
        end: 3,
      },
      {
        trackId: track.id,
        lineId: earlierLine.id,
        position: 1,
        text: 'life?',
        start: 1,
        end: 1.5,
      },
      {
        trackId: track.id,
        lineId: earlierLine.id,
        position: 0,
        text: 'Hello',
        start: 0.2,
        end: 0.7,
      },
    ]);

    const response = await get(`${track.id}/lyrics`).expect(200);

    expect(trackLyricsSchema.parse(response.body)).toEqual({
      lines: [
        {
          start: 0,
          end: 2,
          words: [
            { text: 'Hello', start: 0.2, end: 0.7 },
            { text: 'life?', start: 1, end: 1.5 },
          ],
        },
        {
          start: 2,
          end: 4,
          words: [{ text: 'world', start: 2.5, end: 3 }],
        },
      ],
    });
  });

  it('answers an empty list when a Track has no Timed lyrics', async () => {
    const track = await createTrack(testApp.db);

    const response = await get(`${track.id}/lyrics`).expect(200);

    expect(response.body).toEqual({ lines: [] });
  });

  it('answers RESOURCE_MOVED with the new ID for a legacy ID', async () => {
    const track = await createTrack(testApp.db);
    await createLegacyTrackId(testApp.db, track.id, 'clx123abc');

    const response = await get('clx123abc/lyrics').expect(404);

    expect(response.body).toMatchObject({
      code: 'RESOURCE_MOVED',
      details: { id: track.id },
    });
  });

  it('answers NOT_FOUND for an unknown Track ID', async () => {
    const response = await get('no-such-track/lyrics').expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});
