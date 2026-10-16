import { TrackLyricsRepository } from '../src/modules/tracks/track-lyrics.repository.js';
import { TRACK_MP3_QUEUE } from '../src/modules/tracks/track-mp3.job.js';
import { runStepJobSchema } from '../src/modules/tracks/track-processing.job.js';
import type { TestApp } from './utils/create-test-app.js';
import {
  queuedTrackJobs,
  runNextTrackJob,
  runTrackJobs,
} from './utils/track-pipeline.js';
import {
  processingRowOf,
  requestTrack,
  resetTrackProcessingApp,
  startTrackProcessingApp,
  type TrackProcessingApp,
} from './utils/track-processing-harness.js';

// One giant provider segment becomes many short stored lines: the lyrics step
// builds Timed lyric lines from word timestamps only. The transcription is
// faked at its integration boundary; the audio goes through the real ffmpeg
// and the real storage.

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

/** A long word stream in a single provider segment, with phrase gaps. */
const LONG_WORD_STREAM = {
  segments: [{ start: 0, end: 80 }],
  words: [
    { word: ' Mama,', start: 0.5, end: 0.9 },
    { word: ' just', start: 1.0, end: 1.2 },
    { word: ' killed', start: 1.3, end: 1.7 },
    { word: ' a', start: 1.8, end: 1.9 },
    { word: ' man.', start: 2.0, end: 2.4 },
    { word: ' Put', start: 3.3, end: 3.5 },
    { word: ' a', start: 3.6, end: 3.7 },
    { word: ' gun', start: 3.8, end: 4.1 },
    { word: ' against', start: 4.2, end: 4.6 },
    { word: ' his', start: 4.7, end: 4.9 },
    { word: ' head,', start: 5.0, end: 5.4 },
    { word: ' pulled', start: 5.5, end: 5.9 },
    { word: ' my', start: 6.0, end: 6.2 },
    { word: ' trigger,', start: 6.3, end: 6.8 },
    { word: ' now', start: 6.9, end: 7.2 },
    { word: " he's", start: 7.3, end: 7.6 },
    { word: ' dead.', start: 7.7, end: 8.2 },
    { word: ' Mama,', start: 9.4, end: 9.8 },
    { word: ' life', start: 9.9, end: 10.2 },
    { word: ' had', start: 10.3, end: 10.5 },
    { word: ' just', start: 10.6, end: 10.8 },
    { word: ' begun.', start: 10.9, end: 11.4 },
    { word: ' Did', start: 14.0, end: 14.3 },
    { word: ' not', start: 14.4, end: 14.6 },
    { word: ' mean', start: 14.7, end: 15.0 },
    { word: ' to', start: 15.1, end: 15.2 },
    { word: ' make', start: 15.3, end: 15.6 },
    { word: ' you', start: 15.7, end: 15.9 },
    { word: ' cry.', start: 16.0, end: 16.4 },
  ],
};

describe('Track Processing long lyric lines (e2e)', () => {
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

  it('stores many short lines from one long provider segment', async () => {
    app.transcription.transcription = LONG_WORD_STREAM;
    const trackId = await requestTrack(app);
    await runUntilLyricsStep(testApp);
    await workerUploadsVocals(app, trackId);

    await runTrackJobs(testApp);

    const lines = await testApp.app
      .get(TrackLyricsRepository)
      .findTimedLyrics(trackId);
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) {
      expect(line.words.length).toBeGreaterThan(0);
      expect(line.words.length).toBeLessThanOrEqual(12);
      const text = line.words.map((item) => item.text).join(' ');
      expect(text.length).toBeLessThanOrEqual(75);
      expect(line.end - line.start).toBeLessThanOrEqual(7);
    }
    const starts = lines.map((line) => line.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    for (const [index, line] of lines.entries()) {
      const next = lines[index + 1];
      if (next !== undefined) {
        expect(line.end).toBeLessThanOrEqual(next.start);
      }
      const first = line.words[0];
      const last = line.words[line.words.length - 1];
      expect(line.start).toBe(first?.start);
      expect(line.end).toBe(last?.end);
    }
  });
});
