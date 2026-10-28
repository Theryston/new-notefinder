import { trackDetailSchema } from '@vozzify/contracts';
import request from 'supertest';
import { backfillTrackNoteSummaries } from '../src/database/backfill-track-note-summaries.js';
import { trackNotes } from '../src/database/schema/track-notes.js';
import type { TestApp } from './utils/create-test-app.js';
import { createTrack } from './utils/factories.js';
import { runTrackJobs } from './utils/track-pipeline.js';
import {
  requestTrack,
  resetTrackProcessingApp,
  startTrackProcessingApp,
  type TrackProcessingApp,
} from './utils/track-processing-harness.js';

// The vocal range and the estimated key a Track keeps of its notes: written
// when a Processing replaces the notes, filled for the Tracks completed before
// they existed, and shown by the Track header.

/** A G major melody, from G4 (67) to F#5 (78), one second per note. */
const G_MAJOR_MELODY = [67, 69, 71, 72, 74, 76, 78, 67, 67, 74].map(
  (pitch, index) => ({ pitch, start: index, end: index + 1 }),
);

describe('Track vocal range and key (e2e)', () => {
  let app: TrackProcessingApp;
  let testApp: TestApp;

  const headerOf = async (trackId: string) => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/v1/tracks/${trackId}`)
      .expect(200);
    return trackDetailSchema.parse(response.body);
  };

  beforeAll(async () => {
    app = await startTrackProcessingApp();
    testApp = app.testApp;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetTrackProcessingApp(app);
  });

  it('writes both when a Processing completes with notes', async () => {
    app.noteDetection.notes = G_MAJOR_MELODY;
    const trackId = await requestTrack(app);

    await runTrackJobs(testApp);

    expect(await headerOf(trackId)).toMatchObject({
      hasNotes: true,
      vocalRange: { lowest: 67, highest: 78 },
      key: { tonic: 7, mode: 'MAJOR' },
    });
  });

  it('shows neither for a Track whose Processing found no voice', async () => {
    app.noteDetection.notes = [];
    const trackId = await requestTrack(app);

    await runTrackJobs(testApp);

    const header = await headerOf(trackId);
    expect(header.hasNotes).toBe(false);
    expect(header).not.toHaveProperty('vocalRange');
    expect(header).not.toHaveProperty('key');
  });

  it('backfills the Tracks that have notes and no summary, once', async () => {
    const completed = await createTrack(testApp.db);
    const instrumental = await createTrack(testApp.db);
    await testApp.db
      .insert(trackNotes)
      .values(
        G_MAJOR_MELODY.map((note) => ({ ...note, trackId: completed.id })),
      );

    await expect(backfillTrackNoteSummaries(testApp.db)).resolves.toBe(1);
    await expect(backfillTrackNoteSummaries(testApp.db)).resolves.toBe(0);

    expect(await headerOf(completed.id)).toMatchObject({
      vocalRange: { lowest: 67, highest: 78 },
      key: { tonic: 7, mode: 'MAJOR' },
    });
    expect(await headerOf(instrumental.id)).not.toHaveProperty('vocalRange');
  });
});
