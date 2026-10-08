import {
  trackContributions,
  trackContributors,
} from '../src/database/schema/track-contributors.js';
import { trackProcessings } from '../src/database/schema/track-processings.js';
import { tracks } from '../src/database/schema/tracks.js';
import {
  RUN_STEP_JOB,
  TRACK_PROCESSING_QUEUE,
} from '../src/modules/tracks/track-processing.job.js';
import { TrackProcessingRepository } from '../src/modules/tracks/track-processing.repository.js';
import type { FakeQueue } from './redis-test-overrides.js';
import type { TestApp } from './utils/create-test-app.js';
import {
  createPasswordUser,
  createTrack,
  testMbid,
} from './utils/factories.js';
import { youtubeVideo } from './utils/fake-youtube-music.js';
import { queuedTrackJobs, runTrackJobs } from './utils/track-pipeline.js';
import { createTrackProcessing } from './utils/track-processing-factories.js';
import {
  LINKED_VIDEO,
  processingRowOf,
  requestTrack,
  resetTrackProcessingApp,
  signedInClient,
  startTrackProcessingApp,
  type TrackProcessingApp,
} from './utils/track-processing-harness.js';

// The requests that queue or restart a Processing, and the guarded writes a
// late job makes. A new Track queues its first step once its rows are written.
// A request for a Track that already exists restarts its Processing only while
// that Processing is still queued, and writes nothing. A write from a job that
// ran late changes nothing once the Processing has moved on. The queue is the
// e2e fake: it records each job, and can be made to refuse them, as when Redis
// is down.
describe('Track Processing requests (e2e)', () => {
  let app: TrackProcessingApp;
  let testApp: TestApp;

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

  /** The fake queue of the Processing jobs. */
  const processingQueue = (): FakeQueue => {
    const queue = testApp.queues[TRACK_PROCESSING_QUEUE];
    if (queue === undefined) {
      throw new Error('The Processing queue is not faked');
    }
    return queue;
  };

  /** Runs `run` while the Processing queue refuses every job, as when Redis is down. */
  const withProcessingQueueDown = async <T>(
    run: () => Promise<T>,
  ): Promise<T> => {
    const queue = processingQueue();
    const add = queue.add;
    queue.add = () => Promise.reject(new Error('Redis is unreachable'));
    try {
      return await run();
    } finally {
      queue.add = add;
    }
  };

  /** A new signed-in User asks for a Recording's Track; answers the response. */
  const askForTrack = async (mbid = testMbid(1)) => {
    const user = await createPasswordUser(testApp.db);
    const client = await signedInClient(testApp, user);
    return client
      .post('/v1/tracks')
      .send({ recordingMbid: mbid, locale: 'en' });
  };

  /** Every row a request can write, as the database holds them. */
  const rowsOf = async () => ({
    tracks: await testApp.db.select().from(tracks),
    processings: await testApp.db.select().from(trackProcessings),
    contributors: await testApp.db.select().from(trackContributors),
    contributions: await testApp.db.select().from(trackContributions),
  });

  /** The only row of a list; the spec fails when there is not exactly one. */
  const soleRow = <T>(rows: T[]): T => {
    expect(rows).toHaveLength(1);
    const [row] = rows;
    if (row === undefined) {
      throw new Error('Expected exactly one row');
    }
    return row;
  };

  describe('a Track requested for the first time', () => {
    it('queues the first step of its Processing, named by the Processing ID', async () => {
      const trackId = await requestTrack(app);

      const processing = await processingRowOf(testApp, trackId);
      expect(queuedTrackJobs(testApp)).toEqual([
        {
          name: RUN_STEP_JOB,
          data: { processingId: processing.id, step: 'FINDING_VIDEO' },
        },
      ]);
    });
  });

  describe('a request after a failed start', () => {
    it('answers 500 when the first step cannot be queued, and keeps the Track it wrote', async () => {
      const response = await withProcessingQueueDown(() => askForTrack());

      expect(response.status).toBe(500);
      const rows = await rowsOf();
      expect(rows.tracks).toHaveLength(1);
      expect(rows.processings).toMatchObject([{ status: 'QUEUED' }]);
      expect(queuedTrackJobs(testApp)).toEqual([]);
    });

    it('queues the first step on the next request for the Recording, and writes nothing new', async () => {
      await withProcessingQueueDown(() => askForTrack());
      const before = await rowsOf();
      const processing = soleRow(before.processings);

      const response = await askForTrack();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ trackId: processing.trackId });
      expect(await rowsOf()).toEqual(before);
      expect(queuedTrackJobs(testApp)).toEqual([
        {
          name: RUN_STEP_JOB,
          data: { processingId: processing.id, step: 'FINDING_VIDEO' },
        },
      ]);
    });
  });

  describe('a request for a Track that already exists', () => {
    it('queues nothing when the Track has no Processing', async () => {
      await createTrack(testApp.db, { recordingMbid: testMbid(1) });

      const response = await askForTrack();

      expect(response.status).toBe(200);
      expect(queuedTrackJobs(testApp)).toEqual([]);
      expect((await rowsOf()).processings).toEqual([]);
    });

    it('queues nothing when its Processing has already started', async () => {
      const track = await createTrack(testApp.db, {
        recordingMbid: testMbid(1),
      });
      await createTrackProcessing(testApp.db, track.id, {
        status: 'FINDING_VIDEO',
        startedAt: new Date(),
      });
      const before = await rowsOf();

      const response = await askForTrack();

      expect(response.status).toBe(200);
      expect(queuedTrackJobs(testApp)).toEqual([]);
      expect(await rowsOf()).toEqual(before);
    });

    it('queues nothing once its Processing has completed', async () => {
      const trackId = await requestTrack(app);
      await runTrackJobs(testApp);
      const before = await rowsOf();

      const response = await askForTrack();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ trackId });
      expect(queuedTrackJobs(testApp)).toEqual([]);
      expect(await rowsOf()).toEqual(before);
      expect(await processingRowOf(testApp, trackId)).toMatchObject({
        status: 'COMPLETED',
      });
    });

    it('queues nothing once its Processing has failed', async () => {
      app.youtube.results = [
        youtubeVideo({ artists: ['Adele'], title: 'Hello' }),
      ];
      const trackId = await requestTrack(app);
      await runTrackJobs(testApp);
      const before = await rowsOf();

      const response = await askForTrack();

      expect(response.status).toBe(200);
      expect(queuedTrackJobs(testApp)).toEqual([]);
      expect(await rowsOf()).toEqual(before);
      expect(await processingRowOf(testApp, trackId)).toMatchObject({
        status: 'FAILED',
        failureCode: 'VIDEO_NOT_FOUND',
      });
    });
  });

  describe('late writes', () => {
    const video = { videoId: LINKED_VIDEO, source: 'musicbrainz' } as const;

    /**
     * What a job that ran late tries on a Processing that moved on: each of
     * its guarded writes must match no row and answer false.
     */
    const expectLateWritesRefused = async (processingId: string) => {
      const late = testApp.app.get(TrackProcessingRepository);

      expect(
        await late.markStepStarted(processingId, 'FINDING_VIDEO', [
          'QUEUED',
          'FINDING_VIDEO',
        ]),
      ).toBe(false);
      expect(await late.saveVideo(processingId, 'FINDING_VIDEO', video)).toBe(
        false,
      );
      expect(
        await late.markFailed(processingId, ['FINDING_VIDEO'], {
          code: 'INTERNAL',
          resumeFrom: 'FINDING_VIDEO',
        }),
      ).toBe(false);
      expect(await late.markCompleted(processingId, 'FINDING_VIDEO')).toBe(
        false,
      );
    };

    it('change nothing in a COMPLETED Processing', async () => {
      const trackId = await requestTrack(app);
      await runTrackJobs(testApp);
      const before = await processingRowOf(testApp, trackId);

      await expectLateWritesRefused(before.id);

      expect(await processingRowOf(testApp, trackId)).toEqual(before);
    });

    it('change nothing in a FAILED Processing, and keep its first failure', async () => {
      app.youtube.results = [
        youtubeVideo({ artists: ['Adele'], title: 'Hello' }),
      ];
      const trackId = await requestTrack(app);
      await runTrackJobs(testApp);
      const before = await processingRowOf(testApp, trackId);
      expect(before).toMatchObject({
        status: 'FAILED',
        failureCode: 'VIDEO_NOT_FOUND',
      });

      await expectLateWritesRefused(before.id);

      expect(await processingRowOf(testApp, trackId)).toEqual(before);
    });

    it('take effect while the Processing is where the job expects it', async () => {
      const trackId = await requestTrack(app);
      const queued = await processingRowOf(testApp, trackId);
      const current = testApp.app.get(TrackProcessingRepository);

      expect(
        await current.markStepStarted(queued.id, 'FINDING_VIDEO', ['QUEUED']),
      ).toBe(true);
      expect(await current.saveVideo(queued.id, 'FINDING_VIDEO', video)).toBe(
        true,
      );
      expect(await processingRowOf(testApp, trackId)).toMatchObject({
        status: 'FINDING_VIDEO',
        videoId: LINKED_VIDEO,
        videoSource: 'musicbrainz',
      });
    });
  });
});
