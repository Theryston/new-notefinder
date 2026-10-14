import { trackDetailSchema } from '@notefinder/contracts';
import request from 'supertest';
import { TrackNotesRepository } from '../src/modules/tracks/track-notes.repository.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

describe('Track key and vocal range (e2e)', () => {
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

  it('returns derived metadata on the completed Track header', async () => {
    const track = await createCompletedTrack(testApp.db);
    const notes = testApp.app.get(TrackNotesRepository);
    const durations = [
      6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
    ];
    await notes.replaceNotes(
      track.id,
      durations.map((duration, pitchClass) => ({
        pitch: 60 + pitchClass,
        start: 0,
        end: duration,
      })),
    );

    const response = await request(testApp.app.getHttpServer())
      .get(`/v1/tracks/${track.id}`)
      .expect(200);

    expect(trackDetailSchema.parse(response.body)).toMatchObject({
      id: track.id,
      hasNotes: true,
      vocalRange: { lowMidi: 60, highMidi: 71 },
      estimatedKey: { tonic: 0, mode: 'MAJOR' },
    });
  });
});
