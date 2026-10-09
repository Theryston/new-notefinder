import { type Locale, trackProcessingStateSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import type { Response } from 'supertest';
import {
  trackContributions,
  trackContributors,
} from '../src/database/schema/track-contributors.js';
import { trackProcessings } from '../src/database/schema/track-processings.js';
import { users } from '../src/database/schema/users.js';
import { WEB_REVALIDATION_QUEUE } from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { TRACK_PROCESSING_QUEUE } from '../src/modules/tracks/track-processing.job.js';
import { createAuthClient } from './utils/auth.js';
import type { TestApp } from './utils/create-test-app.js';
import { createPasswordUser, testMbid, type User } from './utils/factories.js';
import { youtubeVideo } from './utils/fake-youtube-music.js';
import { queuedTrackJobs, runTrackJobs } from './utils/track-pipeline.js';
import { createLegacyTrackId } from './utils/track-processing-factories.js';
import {
  bohemian,
  processingOf,
  processingRowOf,
  requestTrackAs,
  resetTrackProcessingApp,
  retryTrackAs,
  startTrackProcessingApp,
  type TrackProcessingApp,
} from './utils/track-processing-harness.js';

// Retrying a failed Processing (ADR 0005): a new Processing that keeps the
// outputs of the failed run and starts at its step, the retrying User becomes a
// Contributor, and the rules refuse what a retry may not do.

describe('Track retry (e2e)', () => {
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

  const requestAs = (user: User, locale: Locale, mbid = testMbid(1)) =>
    requestTrackAs(app, user, locale, mbid);
  const retryAs = (user: User, trackId: string, locale: string) =>
    retryTrackAs(testApp, user, trackId, locale);
  /** A refusal: its status and the API's error code. */
  const expectRefusal = (response: Response, status: number, code: string) => {
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ code });
  };

  /** A Track whose Processing failed with INTERNAL (retryable), requested by `user`. */
  const failedTrackOf = async (user: User): Promise<string> => {
    app.youtube.searchFailure = new Error('YouTube is down');
    const trackId = await requestAs(user, 'en');
    await runTrackJobs(testApp);
    app.youtube.searchFailure = undefined;
    return trackId;
  };

  /** Every Processing row of a Track, oldest first. */
  const processingsOf = (trackId: string) =>
    testApp.db
      .select()
      .from(trackProcessings)
      .where(eq(trackProcessings.trackId, trackId));

  it('answers 202 with the queued Processing, resuming at the step that failed', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));

    const response = await retryAs(
      await createPasswordUser(testApp.db),
      trackId,
      'pt-BR',
    );

    expect(response.status).toBe(202);
    expect(
      trackProcessingStateSchema.parse(response.body).processing,
    ).toMatchObject({
      status: 'QUEUED',
      failureCode: null,
      resumeFrom: 'FINDING_VIDEO',
      retryable: false,
    });
  });

  it('starts a new Processing row and queues its first step', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));
    const failed = await processingRowOf(testApp, trackId);

    await retryAs(await createPasswordUser(testApp.db), trackId, 'en');

    const rows = await processingsOf(trackId);
    const retry = rows.find((row) => row.id !== failed.id);
    expect(rows).toHaveLength(2);
    expect(retry).toMatchObject({
      status: 'QUEUED',
      resumeFrom: 'FINDING_VIDEO',
    });
    expect(queuedTrackJobs(testApp)).toEqual([
      {
        name: 'run-step',
        data: { processingId: retry?.id, step: 'FINDING_VIDEO' },
      },
    ]);
    expect(testApp.queues[TRACK_PROCESSING_QUEUE]?.added).toHaveLength(1);
  });

  it('makes the retrying User a Contributor through a RETRY Contribution, and keeps their locale', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));
    const retrier = await createPasswordUser(testApp.db);

    await retryAs(retrier, trackId, 'pt-BR');

    const retry = (await processingsOf(trackId)).find(
      (row) => row.status === 'QUEUED',
    );
    const [contribution] = await testApp.db
      .select({
        kind: trackContributions.kind,
        userId: trackContributors.userId,
      })
      .from(trackContributions)
      .innerJoin(
        trackContributors,
        eq(trackContributors.id, trackContributions.contributorId),
      )
      .where(eq(trackContributions.processingId, retry?.id ?? ''));
    const [row] = await testApp.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, retrier.id));
    expect(contribution).toEqual({ kind: 'RETRY', userId: retrier.id });
    expect(row?.locale).toBe('pt-BR');
    expect((await processingOf(testApp, trackId)).contributors).toHaveLength(2);
  });

  it('keeps the outputs of the failed run, and does not carry its RunPod job', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));
    const failed = await processingRowOf(testApp, trackId);
    await testApp.db
      .update(trackProcessings)
      .set({
        videoId: 'aaaaaaaaaaa',
        videoSource: 'musicbrainz',
        musicWavUrl: 'https://storage.test/music.wav',
        runpodJobId: 'runpod-job-of-the-failed-run',
      })
      .where(eq(trackProcessings.id, failed.id));

    await retryAs(await createPasswordUser(testApp.db), trackId, 'en');

    const retry = (await processingsOf(trackId)).find(
      (row) => row.id !== failed.id,
    );
    expect(retry).toMatchObject({
      videoId: 'aaaaaaaaaaa',
      videoSource: 'musicbrainz',
      musicWavUrl: 'https://storage.test/music.wav',
      runpodJobId: null,
    });
  });

  it('completes the retry with the carried video, without a new search for it', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));
    const failed = await processingRowOf(testApp, trackId);
    await testApp.db
      .update(trackProcessings)
      .set({ videoId: 'aaaaaaaaaaa', videoSource: 'musicbrainz' })
      .where(eq(trackProcessings.id, failed.id));

    await retryAs(await createPasswordUser(testApp.db), trackId, 'en');
    await runTrackJobs(testApp);

    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'COMPLETED',
      video: { id: 'aaaaaaaaaaa', source: 'musicbrainz' },
    });
  });

  it('refuses a retry after VIDEO_NOT_FOUND, which repeating cannot fix', async () => {
    app.youtube.results = [];
    const trackId = await requestAs(await createPasswordUser(testApp.db), 'en');
    await runTrackJobs(testApp);

    const response = await retryAs(
      await createPasswordUser(testApp.db),
      trackId,
      'en',
    );

    expectRefusal(response, 409, 'CONFLICT');
  });

  it('refuses a retry of a Processing that completed', async () => {
    const trackId = await requestAs(await createPasswordUser(testApp.db), 'en');
    await runTrackJobs(testApp);

    const response = await retryAs(
      await createPasswordUser(testApp.db),
      trackId,
      'en',
    );

    expectRefusal(response, 409, 'CONFLICT');
  });

  it('refuses a second retry while the first one is still queued', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));
    await retryAs(await createPasswordUser(testApp.db), trackId, 'en');

    const response = await retryAs(
      await createPasswordUser(testApp.db),
      trackId,
      'en',
    );

    expectRefusal(response, 409, 'CONFLICT');
  });

  it('answers NOT_FOUND for an unknown Track, and RESOURCE_MOVED with the new ID for a legacy one', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));
    await createLegacyTrackId(testApp.db, trackId, 'legacy-track-1');
    const retrier = await createPasswordUser(testApp.db);

    const unknown = await retryAs(retrier, 'missing-track', 'en');
    const legacy = await retryAs(retrier, 'legacy-track-1', 'en');

    expectRefusal(unknown, 404, 'NOT_FOUND');
    expectRefusal(legacy, 404, 'RESOURCE_MOVED');
    expect(legacy.body).toMatchObject({ details: { id: trackId } });
  });

  it('refuses a retry past the active limit of the User', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));
    const busy = await createPasswordUser(testApp.db);
    for (const n of [2, 3, 4]) {
      app.recordings.set(testMbid(n), bohemian({ mbid: testMbid(n) }));
      await requestAs(busy, 'en', testMbid(n));
    }

    const response = await retryAs(busy, trackId, 'en');

    expectRefusal(response, 429, 'PROCESSING_LIMIT_REACHED');
    expect(response.body).toMatchObject({
      details: { limit: 'ACTIVE_PROCESSINGS', max: 3 },
    });
  });

  it('answers 401 without a session, and 400 for a locale the API does not know', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));

    await createAuthClient(testApp)
      .post(`/v1/tracks/${trackId}/processing/retry`)
      .send({ locale: 'en' })
      .expect(401);
    const invalid = await retryAs(
      await createPasswordUser(testApp.db),
      trackId,
      'fr',
    );

    expectRefusal(invalid, 400, 'VALIDATION_FAILED');
  });

  it('refuses a retry after TOO_LONG, which repeating cannot fix', async () => {
    app.recordings.set(testMbid(1), bohemian({ lengthMs: null }));
    app.youtube.results = [youtubeVideo({ durationSeconds: 1_200 })];
    const trackId = await requestAs(await createPasswordUser(testApp.db), 'en');
    await runTrackJobs(testApp);
    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      failureCode: 'TOO_LONG',
    });

    const response = await retryAs(
      await createPasswordUser(testApp.db),
      trackId,
      'en',
    );

    expectRefusal(response, 409, 'CONFLICT');
  });

  it('refuses a retry while the latest Processing is running a step', async () => {
    const trackId = await requestAs(await createPasswordUser(testApp.db), 'en');
    await testApp.db
      .update(trackProcessings)
      .set({ status: 'EXTRACTING_VOCALS' })
      .where(eq(trackProcessings.trackId, trackId));

    const response = await retryAs(
      await createPasswordUser(testApp.db),
      trackId,
      'en',
    );

    expectRefusal(response, 409, 'CONFLICT');
  });

  it('lets exactly one of two parallel retries start a Processing', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));

    const [first, second] = await Promise.all([
      retryAs(await createPasswordUser(testApp.db), trackId, 'en'),
      retryAs(await createPasswordUser(testApp.db), trackId, 'pt-BR'),
    ]);

    expect([first.status, second.status].sort()).toEqual([202, 409]);
    expect(await processingsOf(trackId)).toHaveLength(2);
  });

  it('lets an ADMIN retry past the active limit of the Users', async () => {
    const trackId = await failedTrackOf(await createPasswordUser(testApp.db));
    const admin = await createPasswordUser(testApp.db, { role: 'ADMIN' });
    for (const n of [2, 3, 4]) {
      app.recordings.set(testMbid(n), bohemian({ mbid: testMbid(n) }));
      await requestAs(admin, 'en', testMbid(n));
    }

    const response = await retryAs(admin, trackId, 'en');

    expect(response.status).toBe(202);
  });

  it('keeps the WAV a failed run stored, so the retry downloads nothing again', async () => {
    const creator = await createPasswordUser(testApp.db);
    const revalidations = testApp.queues[WEB_REVALIDATION_QUEUE];
    if (revalidations === undefined) {
      throw new Error('The revalidation queue is not faked');
    }
    // The download step stores the WAV, then the note detection runs; the
    // refresh that completes the Processing fails after the notes stage: the
    // Processing ends FAILED there, resuming at the vocals stage, with the WAV's
    // URL saved.
    const add = revalidations.add;
    revalidations.add = () => Promise.reject(new Error('Redis is down'));
    const trackId = await requestAs(creator, 'en');
    try {
      await runTrackJobs(testApp);
    } finally {
      revalidations.add = add;
    }
    const failed = await processingRowOf(testApp, trackId);
    expect(failed).toMatchObject({
      status: 'FAILED',
      resumeFrom: 'EXTRACTING_LYRICS',
    });
    expect(failed.musicWavUrl).not.toBeNull();
    expect(app.audio.downloads).toHaveLength(1);

    await retryAs(await createPasswordUser(testApp.db), trackId, 'en');
    await runTrackJobs(testApp);

    expect(app.audio.requests).toHaveLength(1);
    expect(app.audio.downloads).toHaveLength(1);
    const retry = (await processingsOf(trackId)).find(
      (row) => row.id !== failed.id,
    );
    expect(retry).toMatchObject({
      status: 'COMPLETED',
      musicWavUrl: failed.musicWavUrl,
    });
  });
});
