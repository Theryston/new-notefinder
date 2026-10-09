import type { Locale } from '@notefinder/contracts';
import { EMAIL_QUEUE } from '../src/integrations/email/email.job.js';
import { TrackJobRunnerService } from '../src/modules/tracks/track-job-runner.service.js';
import type { TestApp } from './utils/create-test-app.js';
import { createPasswordUser, type User } from './utils/factories.js';
import { runTrackJobs } from './utils/track-pipeline.js';
import {
  processingOf,
  processingRowOf,
  requestTrackAs,
  resetTrackProcessingApp,
  retryTrackAs,
  startTrackProcessingApp,
  type TrackProcessingApp,
} from './utils/track-processing-harness.js';

// The emails that tell the Contributors a Processing ended (CONTEXT.md
// "Contributor"): one per Contributor, in their language, with a link to the
// Track; and an email never fails the Processing it is about.

type SentEmail = { to: string; subject: string; html: string; text: string };

describe('Track Processing emails (e2e)', () => {
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
    // The shared reset leaves the email queue alone: each test reads only its own mail.
    testApp.queues[EMAIL_QUEUE]?.added.splice(0);
  });

  /** The emails the email queue has been given, in order. */
  const sentEmails = (): SentEmail[] =>
    (testApp.queues[EMAIL_QUEUE]?.added ?? []).map(
      (job) => job.data as SentEmail,
    );

  const requestAs = (user: User, locale: Locale) =>
    requestTrackAs(app, user, locale);

  it('emails the Contributors of a completed Processing, each in their own language, once', async () => {
    const creator = await createPasswordUser(testApp.db, { locale: 'en' });
    const trackId = await requestAs(creator, 'en');

    await runTrackJobs(testApp);

    const emails = sentEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: creator.email,
      subject: 'Your notes are ready on notefinder',
    });
    expect(emails[0]?.text).toContain(`/en/tracks/${trackId}`);
  });

  it('tells each Contributor of a failed Processing, and of its retry in their own language', async () => {
    const creator = await createPasswordUser(testApp.db);
    app.youtube.searchFailure = new Error('YouTube is down');
    const trackId = await requestAs(creator, 'en');
    await runTrackJobs(testApp);
    app.youtube.searchFailure = undefined;

    const retrier = await createPasswordUser(testApp.db);
    await retryTrackAs(testApp, retrier, trackId, 'pt-BR');
    await runTrackJobs(testApp);

    const emails = sentEmails();
    const failed = emails.filter((email) => email.to === creator.email);
    const completedForRetrier = emails.filter(
      (email) => email.to === retrier.email,
    );
    expect(failed.map((email) => email.subject)).toEqual([
      'We could not finish the notes of a track',
      'Your notes are ready on notefinder',
    ]);
    expect(completedForRetrier).toEqual([
      expect.objectContaining({
        subject: 'As notas da sua música estão prontas no notefinder',
      }),
    ]);
    expect(completedForRetrier[0]?.html).toContain(`/pt-BR/tracks/${trackId}`);
  });

  it('emails every Contributor of a Processing that failed for good', async () => {
    app.youtube.results = [];
    const creator = await createPasswordUser(testApp.db, { locale: 'en' });
    const trackId = await requestAs(creator, 'en');

    await runTrackJobs(testApp);

    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'FAILED',
      failureCode: 'VIDEO_NOT_FOUND',
    });
    expect(sentEmails()).toEqual([
      expect.objectContaining({
        to: creator.email,
        subject: 'We could not finish the notes of a track',
      }),
    ]);
  });

  it('keeps the Processing completed when its emails are refused, and emails once on the replay', async () => {
    const queue = testApp.queues[EMAIL_QUEUE];
    if (queue === undefined) {
      throw new Error('The email queue is not faked');
    }
    const add = queue.add;
    queue.add = () => Promise.reject(new Error('Redis is down'));
    const creator = await createPasswordUser(testApp.db);
    const trackId = await requestAs(creator, 'en');
    try {
      await expect(runTrackJobs(testApp)).rejects.toThrow('Redis is down');
    } finally {
      queue.add = add;
    }

    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'COMPLETED',
    });
    expect(sentEmails()).toEqual([]);
    const processing = await processingRowOf(testApp, trackId);
    expect(processing.contributorsNotifiedAt).toBeNull();

    // BullMQ replays the failed step job once the queue answers again.
    await testApp.app
      .get(TrackJobRunnerService)
      .run(
        'run-step',
        { processingId: processing.id, step: 'FINDING_VIDEO' },
        true,
      );

    expect(sentEmails()).toEqual([
      expect.objectContaining({ to: creator.email }),
    ]);
    expect(
      (await processingRowOf(testApp, trackId)).contributorsNotifiedAt,
    ).not.toBeNull();
  });

  it('does not email again on a replayed step job of a finished Processing', async () => {
    const creator = await createPasswordUser(testApp.db);
    const trackId = await requestAs(creator, 'en');
    await runTrackJobs(testApp);
    const processing = await processingRowOf(testApp, trackId);

    await testApp.app
      .get(TrackJobRunnerService)
      .run(
        'run-step',
        { processingId: processing.id, step: 'FINDING_VIDEO' },
        true,
      );

    expect(sentEmails()).toHaveLength(1);
  });
});
