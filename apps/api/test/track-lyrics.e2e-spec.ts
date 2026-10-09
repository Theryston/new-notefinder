import { asc, eq } from 'drizzle-orm';
import { DATABASE_POOL } from '../src/database/database.js';
import { trackLyricLines } from '../src/database/schema/track-lyrics.js';
import { FfmpegClient } from '../src/integrations/ffmpeg/ffmpeg.client.js';
import { TrackJobRunnerService } from '../src/modules/tracks/track-job-runner.service.js';
import { TrackLyricsRepository } from '../src/modules/tracks/track-lyrics.repository.js';
import {
  runStepJobSchema,
  TRACK_PROCESSING_QUEUE,
} from '../src/modules/tracks/track-processing.job.js';
import type { TestApp } from './utils/create-test-app.js';
import { testMbid } from './utils/factories.js';
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
  startTrackProcessingApp,
  type TrackProcessingApp,
} from './utils/track-processing-harness.js';

// The lyrics step of a Processing, end to end (ADR 0004): the music and the
// vocals are stored as MP3, and the vocals are transcribed into the Track's
// Timed lyrics. OpenAI is faked at its integration boundary; the audio goes
// through the real ffmpeg and the real storage.

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
  });

  it('stores the MP3s of the music and the vocals, and transcribes the vocals into Timed lyrics', async () => {
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);

    await runTrackJobs(testApp);

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

    const lines = await testApp.app
      .get(TrackLyricsRepository)
      .findTimedLyrics(trackId);

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
      .orderBy(asc(trackLyricLines.position));
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

  it('completes without Timed lyrics when OpenAI keeps refusing, and keeps the MP3s', async () => {
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
    expect(
      await testApp.db
        .select({ id: trackLyricLines.id })
        .from(trackLyricLines)
        .where(eq(trackLyricLines.trackId, trackId)),
    ).toEqual([]);
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
    const lines = await testApp.app
      .get(TrackLyricsRepository)
      .findTimedLyrics(trackId);
    expect(lines).toEqual([]);
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
    // The retry: it answers the lines, and the MP3s are not converted again.
    await runner.run(job.name, job.data, true);
    await runTrackJobs(testApp);

    expect(convert).toHaveBeenCalledTimes(2);
    expect(app.transcription.requests).toHaveLength(2);
    expect(
      await testApp.app.get(TrackLyricsRepository).findTimedLyrics(trackId),
    ).toEqual(EXPECTED_LINES);
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
    const job = {
      name: 'run-step',
      data: {
        processingId: (await processingRowOf(testApp, trackId)).id,
        step: 'EXTRACTING_LYRICS',
      },
    };

    await testApp.app.get(TrackJobRunnerService).run(job.name, job.data, true);

    expect(app.transcription.requests).toHaveLength(1);
    expect(
      await testApp.app.get(TrackLyricsRepository).findTimedLyrics(trackId),
    ).toEqual(EXPECTED_LINES);
  });
});
