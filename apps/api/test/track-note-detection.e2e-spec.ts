import { asc, eq } from 'drizzle-orm';
import { trackNotes } from '../src/database/schema/track-notes.js';
import { StorageService } from '../src/integrations/storage/storage.service.js';
import { TrackJobRunnerService } from '../src/modules/tracks/track-job-runner.service.js';
import { runStepJobSchema } from '../src/modules/tracks/track-processing.job.js';
import type { TestApp } from './utils/create-test-app.js';
import { createPasswordUser } from './utils/factories.js';
import { FAKE_NOTES, type FakeNote } from './utils/fake-note-detection.js';
import {
  queuedTrackJobs,
  runNextTrackJob,
  runTrackJobs,
} from './utils/track-pipeline.js';
import {
  processingOf,
  processingRowOf,
  requestTrack,
  requestTrackAs,
  resetTrackProcessingApp,
  retryTrackAs,
  startTrackProcessingApp,
  type TrackProcessingApp,
} from './utils/track-processing-harness.js';

// The note detection of a Processing, end to end. RunPod is faked at its
// integration boundary: a job is started with the input the API sends, and
// each check answers what the spec scripts. The vocals go through the real
// storage: the worker's upload uses the presigned URL, and the public URL
// serves the file. The stages are driven by the same delayed jobs as in
// production, and the Processing endpoint shows what a viewer sees.

type QueuedJob = { name: string; data: unknown };

/** A queued step job, parsed the way the queue parses it; undefined for any other job. */
const stepOf = (job: QueuedJob) => {
  const parsed = runStepJobSchema.safeParse(job.data);
  return parsed.success ? parsed.data : undefined;
};

/** Runs the queued jobs in order until the first one in the queue matches. */
const runJobsUntil = async (
  testApp: TestApp,
  matches: (job: QueuedJob) => boolean,
): Promise<void> => {
  for (;;) {
    const head = queuedTrackJobs(testApp)[0];
    if (head === undefined || matches(head)) {
      return;
    }
    await runNextTrackJob(testApp);
  }
};

/** The notes stored for a Track, in the order they are sung. */
const storedNotesOf = (testApp: TestApp, trackId: string) =>
  testApp.db
    .select({
      note: trackNotes.note,
      octave: trackNotes.octave,
      start: trackNotes.start,
      end: trackNotes.end,
      frequencyMean: trackNotes.frequencyMean,
    })
    .from(trackNotes)
    .where(eq(trackNotes.trackId, trackId))
    .orderBy(asc(trackNotes.start));

describe('Track Processing note detection (e2e)', () => {
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

  it('starts one RunPod job with the music and the vocals upload, then stores the notes', async () => {
    const trackId = await requestTrack(app);

    await runTrackJobs(testApp);

    const processing = await processingRowOf(testApp, trackId);
    const publicUrl = testApp.app
      .get(StorageService)
      .publicUrl(`track-vocals/${trackId}/${processing.id}.wav`);
    expect(app.noteDetection.starts).toEqual([
      {
        processingId: processing.id,
        musicUrl: processing.musicWavUrl,
        vocalsUpload: {
          presignedPutUrl: expect.stringContaining('X-Amz-Signature='),
          contentType: 'audio/wav',
          publicUrl,
        },
      },
    ]);
    expect(processing).toMatchObject({
      status: 'COMPLETED',
      runpodJobId: 'runpod-job-1',
      vocalsWavUrl: publicUrl,
    });
    expect(await storedNotesOf(testApp, trackId)).toEqual(
      [...FAKE_NOTES].sort((a, b) => a.start - b.start),
    );
  });

  it('lets the worker upload the vocals through the presigned URL, served at the public URL', async () => {
    const trackId = await requestTrack(app);
    await runTrackJobs(testApp);
    const wav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);

    const upload = await app.noteDetection.uploadVocals('runpod-job-1', wav);

    expect(upload.status).toBe(200);
    const processing = await processingRowOf(testApp, trackId);
    const stored = await fetch(processing.vocalsWavUrl ?? '');
    expect(stored.status).toBe(200);
    expect(stored.headers.get('content-type')).toBe('audio/wav');
    expect(new Uint8Array(await stored.arrayBuffer())).toEqual(wav);
  });

  it('shows the stages the worker reports on the Processing, as the job reaches them', async () => {
    app.noteDetection.answers = [
      { kind: 'running', stage: 'EXTRACTING_VOCALS' },
      { kind: 'running', stage: 'DETECTING_NOTES' },
      { kind: 'running', stage: 'DETECTING_NOTES' },
      { kind: 'completed' },
    ];
    const trackId = await requestTrack(app);

    // The vocals stage hands over once the worker reports its notes stage;
    // the notes stage is queued and has not checked the job yet.
    await runJobsUntil(
      testApp,
      (job) => stepOf(job)?.step === 'DETECTING_NOTES',
    );
    await runNextTrackJob(testApp);

    expect((await processingOf(testApp, trackId)).processing?.status).toBe(
      'DETECTING_NOTES',
    );
    await runTrackJobs(testApp);
    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'COMPLETED',
      failureCode: null,
    });
  });

  it('replays a run of the vocals stage without starting a second job', async () => {
    await requestTrack(app);
    await runJobsUntil(testApp, (job) => {
      const step = stepOf(job);
      return step?.step === 'EXTRACTING_VOCALS' && step.wait === undefined;
    });
    const [first] = queuedTrackJobs(testApp);
    if (first === undefined) {
      throw new Error('The vocals stage was not queued');
    }
    const runner = testApp.app.get(TrackJobRunnerService);

    await runner.run(first.name, first.data, true);
    await runner.run(first.name, first.data, true);

    expect(app.noteDetection.starts).toHaveLength(1);
    expect(app.noteDetection.checks).toEqual(['runpod-job-1']);
  });

  it('fails with NOTE_DETECTION_FAILED, retryable, when RunPod ends the job in its vocals stage', async () => {
    app.noteDetection.answers = [{ kind: 'failed' }];
    const trackId = await requestTrack(app);

    await runTrackJobs(testApp);

    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'FAILED',
      failureCode: 'NOTE_DETECTION_FAILED',
      retryable: true,
      resumeFrom: 'EXTRACTING_VOCALS',
    });
    expect(await storedNotesOf(testApp, trackId)).toEqual([]);
  });

  it('resumes a failure of the notes stage at the vocals stage, where a retry starts the job again', async () => {
    app.noteDetection.answers = [
      { kind: 'running', stage: 'DETECTING_NOTES' },
      { kind: 'failed' },
    ];
    const trackId = await requestTrack(app);

    await runTrackJobs(testApp);

    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'FAILED',
      failureCode: 'NOTE_DETECTION_FAILED',
      retryable: true,
      resumeFrom: 'EXTRACTING_VOCALS',
    });
    expect((await processingRowOf(testApp, trackId)).runpodJobId).toBe(
      'runpod-job-1',
    );
  });

  it('starts a new RunPod job when a failed Processing is retried, and completes it', async () => {
    app.noteDetection.answers = [
      { kind: 'running', stage: 'DETECTING_NOTES' },
      { kind: 'failed' },
      { kind: 'completed' },
    ];
    const user = await createPasswordUser(testApp.db);
    const trackId = await requestTrackAs(app, user, 'en');
    await runTrackJobs(testApp);

    const retry = await retryTrackAs(testApp, user, trackId, 'en');
    expect(retry.status).toBe(202);
    await runTrackJobs(testApp);

    expect(app.noteDetection.starts).toHaveLength(2);
    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'COMPLETED',
    });
    expect(await storedNotesOf(testApp, trackId)).toHaveLength(
      FAKE_NOTES.length,
    );
  });

  it('ends a job still running at the last check of its budget with NOTE_DETECTION_FAILED', async () => {
    app.noteDetection.answers = [
      { kind: 'running', stage: 'EXTRACTING_VOCALS' },
    ];
    const trackId = await requestTrack(app);

    await runTrackJobs(testApp);

    expect(app.noteDetection.checks).toHaveLength(120);
    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'FAILED',
      failureCode: 'NOTE_DETECTION_FAILED',
      resumeFrom: 'EXTRACTING_VOCALS',
    });
  });

  it('fails with NOTE_DETECTION_FAILED, before any job starts, when RunPod is down', async () => {
    app.noteDetection.requestFailure = new Error('RunPod answered HTTP 503');
    const trackId = await requestTrack(app);

    await runTrackJobs(testApp);

    expect(app.noteDetection.starts).toEqual([]);
    expect((await processingRowOf(testApp, trackId)).runpodJobId).toBeNull();
    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'FAILED',
      failureCode: 'NOTE_DETECTION_FAILED',
      retryable: true,
    });
  });

  it('fails with INTERNAL when the output breaks the worker contract, and stores no notes', async () => {
    // "H" is not a pitch class: the output breaks the worker's contract.
    const malformed: FakeNote = {
      note: 'H',
      octave: 4,
      start: 1.23,
      end: 1.61,
      frequencyMean: 466.16,
    };
    app.noteDetection.notes = [malformed];
    const trackId = await requestTrack(app);

    await runTrackJobs(testApp);

    expect((await processingOf(testApp, trackId)).processing).toMatchObject({
      status: 'FAILED',
      failureCode: 'INTERNAL',
      resumeFrom: 'EXTRACTING_VOCALS',
    });
    expect(await storedNotesOf(testApp, trackId)).toEqual([]);
  });

  it('replaces the notes already on the Track when the Processing completes', async () => {
    const trackId = await requestTrack(app);
    await testApp.db.insert(trackNotes).values({
      trackId,
      note: 'G',
      octave: 3,
      start: 0.1,
      end: 0.2,
      frequencyMean: 196,
    });

    await runTrackJobs(testApp);

    expect(await storedNotesOf(testApp, trackId)).toEqual(
      [...FAKE_NOTES].sort((a, b) => a.start - b.start),
    );
  });

  it('completes a Track whose worker detected no notes, with none stored', async () => {
    app.noteDetection.notes = [];
    const trackId = await requestTrack(app);

    await runTrackJobs(testApp);

    expect((await processingOf(testApp, trackId)).processing?.status).toBe(
      'COMPLETED',
    );
    expect(await storedNotesOf(testApp, trackId)).toEqual([]);
  });
});
