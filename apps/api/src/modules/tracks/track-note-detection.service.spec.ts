import { Test, type TestingModule } from '@nestjs/testing';
import { ZodError } from 'zod';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { NoteDetectionClient } from '../../integrations/note-detection/note-detection.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { TrackNoteDetectionService } from './track-note-detection.service.js';
import { TrackNotesService } from './track-notes.service.js';
import {
  type ProcessingForStep,
  TrackProcessingRepository,
} from './track-processing.repository.js';
import { DONE, STOPPED } from './track-step-outcome.js';

// The note detection steps' decisions: when to start the job, when to check it
// again, when a stage is over, when to give up, and what to store. RunPod, the
// storage and the rows are fakes; the e2e spec runs the real ones.

// `saveOutput` is `@Transactional()`: the database module runs it on a
// stand-in transaction client, so the write path runs without a database.
const tx = { name: 'tx' };
const db = {
  name: 'db',
  transaction: vi.fn(async (callback: (client: unknown) => unknown) =>
    callback(tx),
  ),
};
const pool = { end: vi.fn(async () => {}) };

const client = { startJob: vi.fn(), checkJob: vi.fn() };
const storage = { presignPublicPut: vi.fn(), publicUrl: vi.fn() };
const processings = {
  findRunpodJobId: vi.fn(),
  findMusicWavUrl: vi.fn(),
  saveRunpodJobId: vi.fn(),
  saveDetection: vi.fn(),
};
const notes = { replaceNotes: vi.fn() };

const MUSIC_URL = 'https://files.test/track-audio/track-1/processing-1.wav';
const VOCALS_KEY = 'track-vocals/track-1/processing-1.wav';
const VOCALS_URL = `https://files.test/${VOCALS_KEY}`;
const PRESIGNED_URL = `https://files.test/${VOCALS_KEY}?X-Amz-Signature=1`;
const CURVE_KEY = 'track-pitch-curves/track-1/processing-1.bin';
const CURVE_URL = `https://files.test/${CURVE_KEY}`;
const CURVE_PRESIGNED_URL = `${CURVE_URL}?X-Amz-Signature=2`;
const DETECTOR_VERSION = 'note-detector@0123abc';

const processing = (
  overrides: Partial<ProcessingForStep> = {},
): ProcessingForStep => ({
  id: 'processing-1',
  trackId: 'track-1',
  status: 'EXTRACTING_VOCALS',
  videoId: 'aaaaaaaaaaa',
  videoSource: 'musicbrainz',
  ...overrides,
});

const waitingAt = (round: number) => ({ round, state: null });

const failureWith = (code: string) =>
  expect.objectContaining({ code, message: `Processing failed: ${code}` });

const output = {
  vocalsUrl: VOCALS_URL,
  pitchCurveUrl: CURVE_URL,
  detectorVersion: DETECTOR_VERSION,
  notes: [{ pitch: 70.08, start: 1.23, end: 1.61 }],
};

const completed = { kind: 'completed', output };
const running = (stage?: 'EXTRACTING_VOCALS' | 'DETECTING_NOTES') => ({
  kind: 'running',
  stage,
});
const failed = { kind: 'failed' };

describe('TrackNoteDetectionService', () => {
  let service: TrackNoteDetectionService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    client.startJob.mockResolvedValue('runpod-1');
    client.checkJob.mockResolvedValue(running('EXTRACTING_VOCALS'));
    storage.presignPublicPut.mockImplementation(
      async ({ key }: { key: string }) =>
        key === CURVE_KEY ? CURVE_PRESIGNED_URL : PRESIGNED_URL,
    );
    storage.publicUrl.mockImplementation((key: string) =>
      key === CURVE_KEY ? CURVE_URL : VOCALS_URL,
    );
    processings.findRunpodJobId.mockResolvedValue('runpod-1');
    processings.findMusicWavUrl.mockResolvedValue(MUSIC_URL);
    processings.saveRunpodJobId.mockResolvedValue(true);
    processings.saveDetection.mockResolvedValue(true);
    notes.replaceNotes.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        TrackNoteDetectionService,
        { provide: NoteDetectionClient, useValue: client },
        { provide: StorageService, useValue: storage },
        { provide: TrackProcessingRepository, useValue: processings },
        { provide: TrackNotesService, useValue: notes },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    service = moduleRef.get(TrackNoteDetectionService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe('the vocals stage, starting the job', () => {
    beforeEach(() => {
      processings.findRunpodJobId.mockResolvedValue(null);
    });

    it('starts the job with the music and presigned uploads of the vocals and the Pitch curve, then checks it after a delay', async () => {
      await expect(
        service.extractVocals(processing(), undefined),
      ).resolves.toEqual({ kind: 'wait', delayMs: 5_000, state: null });

      expect(storage.presignPublicPut).toHaveBeenCalledWith({
        key: VOCALS_KEY,
        contentType: 'audio/wav',
        expiresInSeconds: 2 * 60 * 60,
      });
      expect(storage.presignPublicPut).toHaveBeenCalledWith({
        key: CURVE_KEY,
        contentType: 'application/octet-stream',
        expiresInSeconds: 2 * 60 * 60,
      });
      expect(client.startJob).toHaveBeenCalledWith({
        processingId: 'processing-1',
        musicUrl: MUSIC_URL,
        vocalsUpload: {
          presignedPutUrl: PRESIGNED_URL,
          contentType: 'audio/wav',
          publicUrl: VOCALS_URL,
        },
        pitchCurveUpload: {
          presignedPutUrl: CURVE_PRESIGNED_URL,
          contentType: 'application/octet-stream',
          publicUrl: CURVE_URL,
        },
      });
      expect(processings.saveRunpodJobId).toHaveBeenCalledWith(
        'processing-1',
        'runpod-1',
      );
      expect(client.checkJob).not.toHaveBeenCalled();
    });

    it('stops without a saved job when the Processing moved on while the job started', async () => {
      processings.saveRunpodJobId.mockResolvedValue(false);

      await expect(
        service.extractVocals(processing(), undefined),
      ).resolves.toEqual(STOPPED);
    });

    it('fails with NOTE_DETECTION_FAILED, retryable, when RunPod refuses the job', async () => {
      client.startJob.mockRejectedValue(new Error('RunPod answered HTTP 503'));

      await expect(
        service.extractVocals(processing(), undefined),
      ).rejects.toMatchObject(failureWith('NOTE_DETECTION_FAILED'));
      expect(processings.saveRunpodJobId).not.toHaveBeenCalled();
    });

    it('fails as an unexpected error when the Processing has no music to separate', async () => {
      processings.findMusicWavUrl.mockResolvedValue(null);

      const failure = service.extractVocals(processing(), undefined);

      await expect(failure).rejects.toThrow('has no music WAV to separate');
      expect(client.startJob).not.toHaveBeenCalled();
    });
  });

  describe('the vocals stage, with a job saved', () => {
    it('polls the saved job instead of starting another', async () => {
      await service.extractVocals(processing(), waitingAt(3));

      expect(client.startJob).not.toHaveBeenCalled();
      expect(client.checkJob).toHaveBeenCalledWith('runpod-1');
    });

    it('waits again while the job is still in its vocals stage, after the same delay', async () => {
      await expect(
        service.extractVocals(processing(), waitingAt(1)),
      ).resolves.toEqual({ kind: 'wait', delayMs: 5_000, state: null });
    });

    it('is done once the worker reports its notes stage', async () => {
      client.checkJob.mockResolvedValue(running('DETECTING_NOTES'));

      await expect(
        service.extractVocals(processing(), waitingAt(4)),
      ).resolves.toBe(DONE);
    });

    it('is done when the job has already completed, the notes stage reads its output', async () => {
      client.checkJob.mockResolvedValue(completed);

      await expect(
        service.extractVocals(processing(), waitingAt(1)),
      ).resolves.toBe(DONE);
      expect(processings.saveDetection).not.toHaveBeenCalled();
      expect(notes.replaceNotes).not.toHaveBeenCalled();
    });

    it('ends the Processing with NOTE_DETECTION_FAILED when RunPod ends the job', async () => {
      client.checkJob.mockResolvedValue(failed);

      await expect(
        service.extractVocals(processing(), waitingAt(1)),
      ).resolves.toEqual({ kind: 'failed', code: 'NOTE_DETECTION_FAILED' });
    });

    it('ends the Processing at the last check of the budget while the job still runs', async () => {
      await expect(
        service.extractVocals(processing(), waitingAt(120)),
      ).resolves.toEqual({ kind: 'failed', code: 'NOTE_DETECTION_FAILED' });
    });

    it('waits again on the check before the last one of the budget', async () => {
      await expect(
        service.extractVocals(processing(), waitingAt(119)),
      ).resolves.toMatchObject({ kind: 'wait' });
    });

    it('fails with NOTE_DETECTION_FAILED, retryable, when RunPod cannot be asked', async () => {
      client.checkJob.mockRejectedValue(new Error('RunPod answered HTTP 500'));

      await expect(
        service.extractVocals(processing(), waitingAt(2)),
      ).rejects.toMatchObject(failureWith('NOTE_DETECTION_FAILED'));
    });
  });

  describe('the notes stage', () => {
    beforeEach(() => {
      processings.findRunpodJobId.mockResolvedValue('runpod-1');
    });

    it('waits while the job runs, after the delay', async () => {
      client.checkJob.mockResolvedValue(running('DETECTING_NOTES'));

      await expect(
        service.detectNotes(processing(), waitingAt(2)),
      ).resolves.toEqual({ kind: 'wait', delayMs: 5_000, state: null });
      expect(client.checkJob).toHaveBeenCalledWith('runpod-1');
      expect(processings.saveDetection).not.toHaveBeenCalled();
    });

    it('stores the vocals and Pitch curve URLs and the version, and replaces the Track notes once the job completes', async () => {
      client.checkJob.mockResolvedValue(completed);

      await expect(
        service.detectNotes(processing(), waitingAt(3)),
      ).resolves.toBe(DONE);

      expect(processings.saveDetection).toHaveBeenCalledWith('processing-1', {
        vocalsWavUrl: VOCALS_URL,
        pitchCurveUrl: CURVE_URL,
        detectorVersion: DETECTOR_VERSION,
      });
      expect(notes.replaceNotes).toHaveBeenCalledWith('track-1', [
        { pitch: 70.08, start: 1.23, end: 1.61 },
      ]);
    });

    it('writes the detection and the notes in one transaction', async () => {
      client.checkJob.mockResolvedValue(completed);

      await service.detectNotes(processing(), undefined);

      expect(db.transaction).toHaveBeenCalledOnce();
      expect(processings.saveDetection).toHaveBeenCalledOnce();
    });

    it('stops without replacing the notes when the Processing moved on', async () => {
      client.checkJob.mockResolvedValue(completed);
      processings.saveDetection.mockResolvedValue(false);

      await expect(
        service.detectNotes(processing(), undefined),
      ).resolves.toEqual(STOPPED);
      expect(notes.replaceNotes).not.toHaveBeenCalled();
    });

    it('stores a completed job with no notes: the Track has none', async () => {
      client.checkJob.mockResolvedValue({
        kind: 'completed',
        output: { ...output, notes: [] },
      });

      await expect(service.detectNotes(processing(), undefined)).resolves.toBe(
        DONE,
      );
      expect(notes.replaceNotes).toHaveBeenCalledWith('track-1', []);
    });

    it('refuses an output the worker did not send in its contract, as an unexpected error', async () => {
      client.checkJob.mockResolvedValue({
        kind: 'completed',
        output: 'CUDA out of memory',
      });

      const failure = service.detectNotes(processing(), undefined);

      await expect(failure).rejects.toBeInstanceOf(ZodError);
      expect(notes.replaceNotes).not.toHaveBeenCalled();
    });

    it('ends the Processing with NOTE_DETECTION_FAILED when RunPod fails the job', async () => {
      client.checkJob.mockResolvedValue(failed);

      await expect(
        service.detectNotes(processing(), waitingAt(1)),
      ).resolves.toEqual({ kind: 'failed', code: 'NOTE_DETECTION_FAILED' });
    });

    it('ends the Processing at the last check of the budget while the job still runs', async () => {
      client.checkJob.mockResolvedValue(running('DETECTING_NOTES'));

      await expect(
        service.detectNotes(processing(), waitingAt(120)),
      ).resolves.toEqual({ kind: 'failed', code: 'NOTE_DETECTION_FAILED' });
    });

    it('fails as an unexpected error when the Processing has no job to read', async () => {
      processings.findRunpodJobId.mockResolvedValue(null);

      const failure = service.detectNotes(processing(), undefined);

      await expect(failure).rejects.toThrow('has no RunPod job');
      expect(client.checkJob).not.toHaveBeenCalled();
    });
  });
});
