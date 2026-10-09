import { desc, eq } from 'drizzle-orm';
import { DATABASE_POOL } from '../src/database/database.js';
import { trackLyricLines } from '../src/database/schema/track-lyrics.js';
import { trackProcessings } from '../src/database/schema/track-processings.js';
import { FfmpegClient } from '../src/integrations/ffmpeg/ffmpeg.client.js';
import {
  StorageError,
  StorageService,
} from '../src/integrations/storage/storage.service.js';
import { WEB_REVALIDATION_QUEUE } from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { TrackJobRunnerService } from '../src/modules/tracks/track-job-runner.service.js';
import { TrackLyricsRepository } from '../src/modules/tracks/track-lyrics.repository.js';
import { TRACK_MP3_QUEUE } from '../src/modules/tracks/track-mp3.job.js';
import { TrackMp3Processor } from '../src/modules/tracks/track-mp3.processor.js';
import { TrackMp3Service } from '../src/modules/tracks/track-mp3.service.js';
import {
  runStepJobSchema,
  TRACK_PROCESSING_QUEUE,
} from '../src/modules/tracks/track-processing.job.js';
import type { TestApp } from './utils/create-test-app.js';
import { createPasswordUser, testMbid } from './utils/factories.js';
import {
  queuedTrackJobs,
  runNextTrackJob,
  runTrackJobs,
} from './utils/track-pipeline.js';
import {
  bohemian,
  processingRowOf,
  requestTrack,
  resetTrackProcessingApp,
  retryTrackAs,
  startTrackProcessingApp,
  type TrackProcessingApp,
} from './utils/track-processing-harness.js';

// The lyrics step of a Processing, end to end (ADR 0004): the vocals are stored as
// MP3 and transcribed into the Track's Timed lyrics, while the music MP3 is a job
// of its own that never holds the lyrics back. OpenAI is faked at its integration
// boundary; the audio goes through the real ffmpeg and the real storage.

type QueuedJob = { name: string; data: unknown };

/** Whether a queued job is the lyrics step of a Processing. */
const isLyricsJob = (job: QueuedJob): boolean => {
  const parsed = runStepJobSchema.safeParse(job.data);
  return parsed.success && parsed.data.step === 'EXTRACTING_LYRICS';
};

/** Runs the queued jobs until the lyrics step is next in the queue. */
const runUntilLyricsStep = async (testApp: TestApp): Promise<void> => {
  for (;;) {
    const head = queuedTrackJobs(testApp)[0];
    if (head === undefined || isLyricsJob(head)) {
      return;
    }
    await runNextTrackJob(testApp);
  }
};

/**
 * Runs every queued music MP3 job as its last attempt, as BullMQ would. The Nest
 * provider of the processor is faked (its worker is not started), so the same
 * class is built over the real service.
 */
const runMusicMp3Jobs = async (testApp: TestApp): Promise<void> => {
  const queue = testApp.queues[TRACK_MP3_QUEUE];
  const processor = new TrackMp3Processor(testApp.app.get(TrackMp3Service));
  for (
    let job = queue?.added.shift();
    job !== undefined;
    job = queue?.added.shift()
  ) {
    await processor.run(job.data, true);
  }
};

/**
 * The worker's upload of the vocals, as the lyrics step finds them in storage.
 * The stored music WAV stands in for the separated vocals: it is a valid WAV.
 */
const workerUploadsVocals = async (
  app: TrackProcessingApp,
  trackId: string,
): Promise<void> => {
  const processing = await processingRowOf(app.testApp, trackId);
  const wav = new Uint8Array(
    await (await fetch(processing.musicWavUrl ?? '')).arrayBuffer(),
  );
  const upload = await app.noteDetection.uploadVocals('runpod-job-1', wav);
  expect(upload.status).toBe(200);
};

/** Whether the bytes start like an MP3: an ID3 tag, or an MPEG frame sync. */
const isMp3 = (bytes: Uint8Array): boolean =>
  (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
  (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0);

/** The MP3 at a stored public URL, read back the way a viewer would. */
const storedMp3Of = async (url: string | null) => {
  const response = await fetch(url ?? '');
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
};

/** The Track's Timed lyrics, read through the repository (one query). */
const timedLyricsOf = (testApp: TestApp, trackId: string) =>
  testApp.app.get(TrackLyricsRepository).findTimedLyrics(trackId);

/** The newest Processing of a Track, which is its current state. */
const latestProcessingOf = async (testApp: TestApp, trackId: string) => {
  const [row] = await testApp.db
    .select()
    .from(trackProcessings)
    .where(eq(trackProcessings.trackId, trackId))
    .orderBy(desc(trackProcessings.createdAt))
    .limit(1);
  if (row === undefined) {
    throw new Error(`Track ${trackId} has no Processing`);
  }
  return row;
};

/** The lines the transcription of FAKE_TRANSCRIPTION makes, with their words. */
const EXPECTED_LINES = [
  {
    start: 1,
    end: 2.5,
    words: [
      { text: 'Is', start: 1.1, end: 1.3 },
      { text: 'this', start: 1.4, end: 1.8 },
    ],
  },
  {
    start: 3,
    end: 4.5,
    words: [
      { text: 'the', start: 3.1, end: 3.3 },
      { text: 'real', start: 3.4, end: 3.8 },
      { text: 'life', start: 3.9, end: 4.3 },
    ],
  },
];

describe('Track Processing lyrics (e2e)', () => {
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
    testApp.queues[TRACK_MP3_QUEUE]?.added.splice(0);
  });

  it('stores the MP3s of the music and the vocals, and transcribes the vocals into Timed lyrics', async () => {
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);

    await runTrackJobs(testApp);
    await runMusicMp3Jobs(testApp);

    const processing = await processingRowOf(testApp, trackId);
    expect(processing.status).toBe('COMPLETED');
    for (const url of [processing.musicMp3Url, processing.vocalsMp3Url]) {
      const stored = await storedMp3Of(url);
      expect(stored.status).toBe(200);
      expect(stored.contentType).toBe('audio/mpeg');
      expect(isMp3(stored.bytes)).toBe(true);
    }
    expect(app.transcription.requests).toHaveLength(1);
    expect(app.transcription.requests[0]?.lyrics).toBeNull();
  });

  it('reads the Timed lyrics back, lines with their words, in one database query', async () => {
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);
    await runTrackJobs(testApp);
    const pool = testApp.app.get(DATABASE_POOL);
    const query = vi.spyOn(pool, 'query');

    const lines = await timedLyricsOf(testApp, trackId);

    expect(query).toHaveBeenCalledTimes(1);
    expect(lines).toEqual(EXPECTED_LINES);
    query.mockRestore();
  });

  it('positions the lines of a Track in the order they are sung', async () => {
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);

    await runTrackJobs(testApp);

    const rows = await testApp.db
      .select({ position: trackLyricLines.position })
      .from(trackLyricLines)
      .where(eq(trackLyricLines.trackId, trackId))
      .orderBy(trackLyricLines.position);
    expect(rows.map((row) => row.position)).toEqual([0, 1]);
  });

  it('guides the transcription with the plain Lyrics of the Recording', async () => {
    app.recordings.set(
      testMbid(1),
      bohemian({ lyrics: { plain: 'Is this the real life?', synced: null } }),
    );
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);

    await runTrackJobs(testApp);

    expect(app.transcription.requests[0]?.lyrics).toBe(
      'Is this the real life?',
    );
  });

  it('completes without Timed lyrics when OpenAI keeps refusing, and keeps the vocals MP3', async () => {
    app.transcription.requestFailure = new Error('OpenAI is down');
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);

    await runTrackJobs(testApp);

    const processing = await processingRowOf(testApp, trackId);
    expect(processing).toMatchObject({
      status: 'COMPLETED',
      failureCode: null,
    });
    expect(processing.vocalsMp3Url).not.toBeNull();
    expect(await timedLyricsOf(testApp, trackId)).toEqual([]);
  });

  it('completes without Timed lyrics when the vocals cannot be converted, and transcribes nothing', async () => {
    const convert = vi
      .spyOn(testApp.app.get(FfmpegClient), 'convertWavToMp3')
      .mockRejectedValueOnce(new Error('ffmpeg is down'));
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);

    await runTrackJobs(testApp);

    expect(await processingRowOf(testApp, trackId)).toMatchObject({
      status: 'COMPLETED',
    });
    expect(app.transcription.requests).toEqual([]);
    expect(await timedLyricsOf(testApp, trackId)).toEqual([]);
    convert.mockRestore();
  });

  it('completes with no lines when OpenAI heard no words', async () => {
    app.transcription.transcription = { segments: [], words: [] };
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);

    await runTrackJobs(testApp);

    expect(await processingRowOf(testApp, trackId)).toMatchObject({
      status: 'COMPLETED',
    });
    expect(await timedLyricsOf(testApp, trackId)).toEqual([]);
  });

  it('retries a failed transcription without converting the MP3s again, and replaces no line twice', async () => {
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);
    const convert = vi.spyOn(testApp.app.get(FfmpegClient), 'convertWavToMp3');
    const runner = testApp.app.get(TrackJobRunnerService);
    const job = testApp.queues[TRACK_PROCESSING_QUEUE]?.added.shift();
    if (job === undefined) {
      throw new Error('No lyrics job is queued');
    }
    app.transcription.requestFailure = new Error('OpenAI is down');

    // BullMQ's first attempt: the job throws, so it is retried.
    await expect(runner.run(job.name, job.data, false)).rejects.toThrow(
      'OpenAI is down',
    );
    expect(await processingRowOf(testApp, trackId)).toMatchObject({
      status: 'EXTRACTING_LYRICS',
    });
    app.transcription.requestFailure = undefined;
    // The retry: it writes the lines, and the vocals MP3 is not converted again.
    await runner.run(job.name, job.data, true);
    await runTrackJobs(testApp);
    await runMusicMp3Jobs(testApp);

    expect(convert).toHaveBeenCalledTimes(2);
    expect(app.transcription.requests).toHaveLength(2);
    expect(await timedLyricsOf(testApp, trackId)).toEqual(EXPECTED_LINES);
    expect(await processingRowOf(testApp, trackId)).toMatchObject({
      status: 'COMPLETED',
    });
    convert.mockRestore();
  });

  it('changes nothing when a finished Processing gets its lyrics job again', async () => {
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);
    await runTrackJobs(testApp);
    const processing = await processingRowOf(testApp, trackId);

    await testApp.app
      .get(TrackJobRunnerService)
      .run(
        'run-step',
        { processingId: processing.id, step: 'EXTRACTING_LYRICS' },
        true,
      );

    expect(app.transcription.requests).toHaveLength(1);
    expect(await timedLyricsOf(testApp, trackId)).toEqual(EXPECTED_LINES);
  });

  it('keeps the lyrics when the music MP3 cannot be converted through its job, and the Processing completes', async () => {
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);
    await runTrackJobs(testApp);
    // The lyrics converted the vocals first; the next conversion is the music's.
    const convert = vi
      .spyOn(testApp.app.get(FfmpegClient), 'convertWavToMp3')
      .mockRejectedValueOnce(new Error('ffmpeg is down'));

    await runMusicMp3Jobs(testApp);

    const processing = await processingRowOf(testApp, trackId);
    expect(processing).toMatchObject({ status: 'COMPLETED' });
    expect(processing.musicMp3Url).toBeNull();
    expect(processing.vocalsMp3Url).not.toBeNull();
    expect(await timedLyricsOf(testApp, trackId)).toEqual(EXPECTED_LINES);
    convert.mockRestore();
  });

  it('keeps the lyrics when the music MP3 cannot be stored through its job, and the Processing completes', async () => {
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);
    await runTrackJobs(testApp);
    // The lyrics stored the vocals MP3 first; the next store is the music's.
    const put = vi
      .spyOn(testApp.app.get(StorageService), 'putPublicObject')
      .mockRejectedValueOnce(new StorageError('storage is down'));

    await runMusicMp3Jobs(testApp);

    const processing = await processingRowOf(testApp, trackId);
    expect(processing).toMatchObject({ status: 'COMPLETED' });
    expect(processing.musicMp3Url).toBeNull();
    expect(await timedLyricsOf(testApp, trackId)).toEqual(EXPECTED_LINES);
    put.mockRestore();
  });

  it('ends a Track whose earlier Processing wrote lyrics with none, when its retry falls back', async () => {
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);
    // The refresh that completes the Processing fails after its lines are written:
    // it ends FAILED at the lyrics stage, with the lines in place.
    const revalidations = testApp.queues[WEB_REVALIDATION_QUEUE];
    if (revalidations === undefined) {
      throw new Error('The revalidation queue is not faked');
    }
    const add = revalidations.add;
    revalidations.add = () => Promise.reject(new Error('Redis is down'));
    try {
      await runTrackJobs(testApp);
    } finally {
      revalidations.add = add;
    }
    expect(await processingRowOf(testApp, trackId)).toMatchObject({
      status: 'FAILED',
      resumeFrom: 'EXTRACTING_LYRICS',
    });
    expect(await timedLyricsOf(testApp, trackId)).toEqual(EXPECTED_LINES);

    // The retry's transcription is refused: the Processing falls back.
    app.transcription.requestFailure = new Error('OpenAI is down');
    await retryTrackAs(
      testApp,
      await createPasswordUser(testApp.db),
      trackId,
      'en',
    );
    await runTrackJobs(testApp);

    expect(await latestProcessingOf(testApp, trackId)).toMatchObject({
      status: 'COMPLETED',
    });
    expect(await timedLyricsOf(testApp, trackId)).toEqual([]);
  });
});
