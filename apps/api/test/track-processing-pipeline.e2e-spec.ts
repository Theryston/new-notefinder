import {
  createTrackResultSchema,
  type Recording,
  trackProcessingStateSchema,
} from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { trackProcessings } from '../src/database/schema/track-processings.js';
import { tracks } from '../src/database/schema/tracks.js';
import { CoverArtClient } from '../src/integrations/cover-art/cover-art.client.js';
import { StorageService } from '../src/integrations/storage/storage.service.js';
import { WEB_REVALIDATION_QUEUE } from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { YouTubeMusicClient } from '../src/integrations/youtube-music/youtube-music.client.js';
import { TrackJobRunner } from '../src/modules/tracks/track-job-runner.service.js';
import { TRACK_PROCESSING_QUEUE } from '../src/modules/tracks/track-processing.job.js';
import { type AuthClient, createAuthClient, signIn } from './utils/auth.js';
import {
  type CreateTestAppOptions,
  createTestApp,
  type TestApp,
} from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createPasswordUser,
  DEFAULT_PASSWORD,
  testMbid,
  type User,
} from './utils/factories.js';
import { FakeCoverArt } from './utils/fake-cover-art.js';
import {
  FAKE_CATALOG_API_KEY,
  type FakeMusicCatalog,
  startFakeMusicCatalog,
} from './utils/fake-music-catalog.js';
import { FakeYouTubeMusic, youtubeVideo } from './utils/fake-youtube-music.js';
import { recordingFixture } from './utils/recording-fixtures.js';
import {
  queuedTrackJobs,
  runNextTrackJob,
  runTrackJobs,
} from './utils/track-pipeline.js';

// The Processing of a requested Track, end to end: the request queues the
// first step, the jobs run through the real runner, the video and the cover
// are saved, and the Processing completes or fails with its code. YouTube and
// the Cover Art Archive are faked at their integration boundaries.

const PRIMARY_RELEASE = testMbid(31); // 1975: the first release of the list
const LATER_RELEASE = testMbid(32); // 1990
const LINKED_VIDEO = 'aaaaaaaaaaa';

const release = (mbid: string, date: string) => ({
  mbid,
  title: 'A Night at the Opera',
  releaseGroup: { mbid: testMbid(40), primaryType: 'Album' },
  status: 'Official',
  date,
  country: 'GB',
  mediumPosition: 1,
  trackPosition: 11,
  coverArtUrl: `https://coverartarchive.org/release/${mbid}/front-500`,
});

const QUEEN = {
  name: 'Queen',
  artists: [
    {
      mbid: testMbid(41),
      name: 'Queen',
      creditedName: 'Queen',
      joinPhrase: '',
    },
  ],
};

/** "Bohemian Rhapsody" by Queen, 5:54, on two releases. */
const bohemian = (overrides: Partial<Recording> = {}): Recording =>
  recordingFixture({
    artistCredit: QUEEN,
    releases: [
      release(LATER_RELEASE, '1990-06-01'),
      release(PRIMARY_RELEASE, '1975-10-31'),
    ],
    ...overrides,
  });

const linkTo = (videoId: string) => ({
  url: `https://music.youtube.com/watch?v=${videoId}`,
  linkType: 'streaming music',
});

/** A PNG the cover job can decode and store. */
const coverImage = async (): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> => ({
  bytes: new Uint8Array(
    await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 3,
        background: { r: 30, g: 60, b: 90 },
      },
    })
      .png()
      .toBuffer(),
  ),
  contentType: 'image/png',
});

describe('Track Processing pipeline (e2e)', () => {
  let catalog: FakeMusicCatalog;
  let testApp: TestApp;
  let recordings: Map<string, Recording>;
  const youtube = new FakeYouTubeMusic();
  const coverArt = new FakeCoverArt();

  const signedInClient = async (user: User): Promise<AuthClient> => {
    const client = createAuthClient(testApp);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    return client;
  };

  /** A signed-in User requests the Track of a Recording; answers its ID. */
  const requestTrack = async (mbid = testMbid(1)): Promise<string> => {
    const user = await createPasswordUser(testApp.db);
    const client = await signedInClient(user);
    const response = await client
      .post('/v1/tracks')
      .send({ recordingMbid: mbid, locale: 'en' })
      .expect(202);
    return createTrackResultSchema.parse(response.body).trackId;
  };

  const processingOf = async (trackId: string) => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/v1/tracks/${trackId}/processing`)
      .expect(200);
    return trackProcessingStateSchema.parse(response.body);
  };

  const processingRowOf = async (trackId: string) => {
    const [row] = await testApp.db
      .select()
      .from(trackProcessings)
      .where(eq(trackProcessings.trackId, trackId));
    if (row === undefined) {
      throw new Error(`Track ${trackId} has no Processing`);
    }
    return row;
  };

  const trackRowOf = async (trackId: string) => {
    const [row] = await testApp.db
      .select()
      .from(tracks)
      .where(eq(tracks.id, trackId));
    if (row === undefined) {
      throw new Error(`Track ${trackId} is gone`);
    }
    return row;
  };

  beforeAll(async () => {
    catalog = await startFakeMusicCatalog((payload) => {
      const recording = recordings.get(String(payload.mbid));
      if (recording === undefined) {
        return {
          error: { code: 'RECORDING_NOT_FOUND', message: 'No such Recording' },
        };
      }
      return { result: recording };
    });
    const options: Pick<CreateTestAppOptions, 'env' | 'override'> = {
      env: {
        MUSIC_CATALOG_URL: catalog.url,
        MUSIC_CATALOG_API_KEY: FAKE_CATALOG_API_KEY,
        MUSIC_CATALOG_REQUEST_TIMEOUT_MS: 1_000,
      },
      override: (builder) =>
        builder
          .overrideProvider(YouTubeMusicClient)
          .useValue(youtube)
          .overrideProvider(CoverArtClient)
          .useValue(coverArt),
    };
    testApp = await createTestApp(options);
  });

  afterAll(async () => {
    await testApp.close();
    await catalog.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    recordings = new Map([[testMbid(1), bohemian()]]);
    youtube.results = [youtubeVideo({ videoId: 'bbbbbbbbbbb' })];
    youtube.videos = new Map();
    youtube.searchFailure = undefined;
    youtube.searches.length = 0;
    youtube.lookups.length = 0;
    coverArt.releaseCovers = new Map();
    coverArt.images = new Map();
    coverArt.releaseFailure = undefined;
    coverArt.releaseRequests.length = 0;
    coverArt.imageRequests.length = 0;
    testApp.queues[TRACK_PROCESSING_QUEUE]?.added.splice(0);
    testApp.queues[WEB_REVALIDATION_QUEUE]?.added.splice(0);
  });

  describe('requesting a Track', () => {
    it('queues the first step once the Track and its Processing exist', async () => {
      const trackId = await requestTrack();

      const processing = await processingRowOf(trackId);
      expect(queuedTrackJobs(testApp)).toEqual([
        {
          name: 'run-step',
          data: { processingId: processing.id, step: 'FINDING_VIDEO' },
        },
      ]);
      expect(processing.status).toBe('QUEUED');
    });

    it('queues nothing for a Recording that already has a Track', async () => {
      const trackId = await requestTrack();
      const queued = queuedTrackJobs(testApp).length;

      const user = await createPasswordUser(testApp.db);
      const client = await signedInClient(user);
      const response = await client
        .post('/v1/tracks')
        .send({ recordingMbid: testMbid(1), locale: 'en' })
        .expect(200);

      expect(createTrackResultSchema.parse(response.body).trackId).toBe(
        trackId,
      );
      expect(queuedTrackJobs(testApp)).toHaveLength(queued);
    });
  });

  describe('finding the video', () => {
    it('chooses the Recording’s own YouTube link when it matches, without searching', async () => {
      recordings.set(
        testMbid(1),
        bohemian({ externalUrls: [linkTo(LINKED_VIDEO)] }),
      );
      youtube.videos.set(LINKED_VIDEO, youtubeVideo({ videoId: LINKED_VIDEO }));
      const trackId = await requestTrack();

      // Only the video step: the cover job searches for artwork on its own.
      await runNextTrackJob(testApp);

      const state = await processingOf(trackId);
      expect(state.processing).toMatchObject({
        status: 'COMPLETED',
        video: { id: LINKED_VIDEO, source: 'musicbrainz' },
      });
      expect((await trackRowOf(trackId)).youtubeVideoId).toBe(LINKED_VIDEO);
      expect(youtube.lookups).toEqual([LINKED_VIDEO]);
      expect(youtube.searches).toEqual([]);
    });

    it('falls back to the best YouTube Music match when the link does not match', async () => {
      recordings.set(
        testMbid(1),
        bohemian({ externalUrls: [linkTo(LINKED_VIDEO)] }),
      );
      youtube.videos.set(
        LINKED_VIDEO,
        youtubeVideo({ videoId: LINKED_VIDEO, artists: ['Adele'] }),
      );
      const trackId = await requestTrack();

      await runNextTrackJob(testApp);

      const state = await processingOf(trackId);
      expect(state.processing).toMatchObject({
        status: 'COMPLETED',
        video: { id: 'bbbbbbbbbbb', source: 'youtube_music' },
      });
      expect(youtube.lookups).toEqual([LINKED_VIDEO]);
      expect(youtube.searches).toEqual(['Queen Bohemian Rhapsody']);
    });

    it('fails with VIDEO_NOT_FOUND when no candidate matches, and that failure is final', async () => {
      youtube.results = [youtubeVideo({ artists: ['Adele'], title: 'Hello' })];
      const trackId = await requestTrack();

      await runTrackJobs(testApp);

      const state = await processingOf(trackId);
      expect(state.processing).toMatchObject({
        status: 'FAILED',
        failureCode: 'VIDEO_NOT_FOUND',
        retryable: false,
        resumeFrom: 'FINDING_VIDEO',
        video: null,
      });
      expect((await trackRowOf(trackId)).youtubeVideoId).toBeNull();
      expect(queuedTrackJobs(testApp)).toEqual([]);
    });

    it('refuses a Recording over the limit before any search', async () => {
      recordings.set(testMbid(1), bohemian({ lengthMs: 1_000_000 }));
      const trackId = await requestTrack();

      await runTrackJobs(testApp);

      const state = await processingOf(trackId);
      expect(state.processing).toMatchObject({
        status: 'FAILED',
        failureCode: 'TOO_LONG',
        retryable: false,
      });
      expect(youtube.searches).toEqual([]);
      expect(youtube.lookups).toEqual([]);
    });

    it('refuses a chosen video over the limit when the Recording has no length', async () => {
      recordings.set(testMbid(1), bohemian({ lengthMs: null }));
      youtube.results = [youtubeVideo({ durationSeconds: 1_200 })];
      const trackId = await requestTrack();

      await runTrackJobs(testApp);

      expect((await processingOf(trackId)).processing).toMatchObject({
        status: 'FAILED',
        failureCode: 'TOO_LONG',
      });
    });

    it('fails with INTERNAL, retryable, when YouTube keeps failing on the last attempt', async () => {
      youtube.searchFailure = new Error('YouTube is down');
      const trackId = await requestTrack();

      await runTrackJobs(testApp);

      expect((await processingOf(trackId)).processing).toMatchObject({
        status: 'FAILED',
        failureCode: 'INTERNAL',
        retryable: true,
        resumeFrom: 'FINDING_VIDEO',
      });
    });

    it('leaves the Processing running while BullMQ still has attempts left', async () => {
      youtube.searchFailure = new Error('YouTube is down');
      const trackId = await requestTrack();
      const job = queuedTrackJobs(testApp)[0];
      testApp.queues[TRACK_PROCESSING_QUEUE]?.added.shift();

      await expect(
        testApp.app.get(TrackJobRunner).run(job?.name ?? '', job?.data, false),
      ).rejects.toThrow('YouTube is down');

      expect((await processingOf(trackId)).processing).toMatchObject({
        status: 'FINDING_VIDEO',
        failureCode: null,
      });
    });
  });

  describe('the cover', () => {
    it('stores the front cover of the primary release in our storage and saves its URL', async () => {
      coverArt.releaseCovers.set(PRIMARY_RELEASE, await coverImage());
      const trackId = await requestTrack();

      await runTrackJobs(testApp);

      expect(coverArt.releaseRequests).toEqual([PRIMARY_RELEASE]);
      const { coverUrl } = await trackRowOf(trackId);
      const storage = testApp.app.get(StorageService);
      expect(coverUrl).toBe(storage.publicUrl(`track-covers/${trackId}.webp`));
      const stored = await fetch(coverUrl ?? '');
      expect(stored.status).toBe(200);
      expect(stored.headers.get('content-type')).toBe('image/webp');
      expect((await processingOf(trackId)).track.coverUrl).toBe(coverUrl);
    });

    it('falls back to the artwork of the best search match when the archive has no cover', async () => {
      const artwork = 'https://img.test/artwork.jpg';
      youtube.results = [youtubeVideo({ artworkUrl: artwork })];
      coverArt.images.set(artwork, await coverImage());
      const trackId = await requestTrack();

      await runTrackJobs(testApp);

      expect(coverArt.imageRequests).toEqual([artwork]);
      expect((await trackRowOf(trackId)).coverUrl).not.toBeNull();
    });

    it('keeps the placeholder when neither source has an image', async () => {
      const trackId = await requestTrack();

      await runTrackJobs(testApp);

      expect((await trackRowOf(trackId)).coverUrl).toBeNull();
      expect((await processingOf(trackId)).processing?.status).toBe(
        'COMPLETED',
      );
    });

    it('does not hold the Processing back when the cover download fails', async () => {
      coverArt.releaseFailure = new Error(
        'Image download failed with HTTP 503',
      );
      const trackId = await requestTrack();

      await runTrackJobs(testApp);

      expect((await processingOf(trackId)).processing?.status).toBe(
        'COMPLETED',
      );
      expect((await trackRowOf(trackId)).coverUrl).toBeNull();
    });
  });

  describe('completing the Processing', () => {
    it('completes it, revalidates the Track pages and keeps the chosen video', async () => {
      const trackId = await requestTrack();

      await runTrackJobs(testApp);

      const state = await processingOf(trackId);
      expect(state.processing).toMatchObject({
        status: 'COMPLETED',
        failureCode: null,
        retryable: false,
        video: { id: 'bbbbbbbbbbb', source: 'youtube_music' },
      });
      expect(state.processing?.finishedAt).not.toBeNull();
      expect(testApp.queues[WEB_REVALIDATION_QUEUE]?.added).toContainEqual({
        name: 'revalidate',
        data: { tags: [`track:${trackId}`, 'tracks'] },
      });
    });
  });

  describe('running a job again', () => {
    it('changes nothing when a finished Processing gets its step job again', async () => {
      const trackId = await requestTrack();
      await runTrackJobs(testApp);
      const processing = await processingRowOf(trackId);
      const searches = youtube.searches.length;

      await testApp.app
        .get(TrackJobRunner)
        .run(
          'run-step',
          { processingId: processing.id, step: 'FINDING_VIDEO' },
          true,
        );

      expect(youtube.searches).toHaveLength(searches);
      expect(queuedTrackJobs(testApp)).toEqual([]);
      expect(await processingRowOf(trackId)).toMatchObject({
        status: 'COMPLETED',
        videoId: 'bbbbbbbbbbb',
      });
    });

    it('keeps the video an earlier run already chose when the step runs again', async () => {
      const trackId = await requestTrack();
      const processing = await processingRowOf(trackId);
      // What a crash after the video was saved, but before the Processing
      // completed, leaves behind: the step is still running, the video is kept.
      await testApp.db
        .update(trackProcessings)
        .set({
          status: 'FINDING_VIDEO',
          videoId: LINKED_VIDEO,
          videoSource: 'musicbrainz',
        })
        .where(eq(trackProcessings.id, processing.id));
      youtube.results = [];

      await testApp.app
        .get(TrackJobRunner)
        .run(
          'run-step',
          { processingId: processing.id, step: 'FINDING_VIDEO' },
          true,
        );

      expect(youtube.searches).toEqual([]);
      expect(await processingRowOf(trackId)).toMatchObject({
        status: 'COMPLETED',
        videoId: LINKED_VIDEO,
        videoSource: 'musicbrainz',
      });
    });

    it('downloads nothing when the cover job runs for a Track that has one', async () => {
      coverArt.releaseCovers.set(PRIMARY_RELEASE, await coverImage());
      const trackId = await requestTrack();
      await runTrackJobs(testApp);
      const releaseRequests = coverArt.releaseRequests.length;
      const searches = youtube.searches.length;

      await testApp.app
        .get(TrackJobRunner)
        .run('store-cover', { trackId }, true);

      expect(coverArt.releaseRequests).toHaveLength(releaseRequests);
      expect(youtube.searches).toHaveLength(searches);
    });
  });
});
