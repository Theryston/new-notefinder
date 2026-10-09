import { Test, type TestingModule } from '@nestjs/testing';
import { AudioDownloadClient } from '../../integrations/audio-download/audio-download.client.js';
import { FfmpegClient } from '../../integrations/ffmpeg/ffmpeg.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { TrackAudioService } from './track-audio.service.js';
import {
  type ProcessingForStep,
  TrackProcessingRepository,
} from './track-processing.repository.js';
import { TrackProcessingFailure } from './track-processing-failure.js';

// The download step's decisions: when to ask, check again, give up or store.
// The services it calls are fakes; the rows and the object store are e2e's.

const downloads = {
  requestConversion: vi.fn(),
  checkConversion: vi.fn(),
  downloadMp3: vi.fn(),
};
const ffmpeg = { convertMp3ToWav: vi.fn() };
const storage = { putPublicObject: vi.fn(), publicUrl: vi.fn() };
const processings = { findMusicWavUrl: vi.fn(), saveMusicWavUrl: vi.fn() };

const PROGRESS_URL = 'https://rapidapi.test/progress/aaaaaaaaaaa';
const DOWNLOAD_URL = 'https://files.test/aaaaaaaaaaa.mp3';
const MP3 = new Uint8Array([1, 2, 3]);
const WAV = new Uint8Array([82, 73, 70, 70]);
const STORED_URL = 'https://files.test/track-audio/track-1.wav';

const processing = (
  overrides: Partial<ProcessingForStep> = {},
): ProcessingForStep => ({
  id: 'processing-1',
  trackId: 'track-1',
  status: 'DOWNLOADING_AUDIO',
  videoId: 'aaaaaaaaaaa',
  videoSource: 'musicbrainz',
  ...overrides,
});

/** The state a re-check carries, and the round it runs as. */
const waitingAt = (round: number) => ({
  round,
  state: { progressUrl: PROGRESS_URL },
});

const expectFailure = (code: string) =>
  expect.objectContaining({
    code,
    message: `Processing failed: ${code}`,
  });

describe('TrackAudioService', () => {
  let service: TrackAudioService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    processings.findMusicWavUrl.mockResolvedValue(null);
    processings.saveMusicWavUrl.mockResolvedValue(true);
    downloads.requestConversion.mockResolvedValue(PROGRESS_URL);
    downloads.checkConversion.mockResolvedValue({ ready: false });
    downloads.downloadMp3.mockResolvedValue(MP3);
    ffmpeg.convertMp3ToWav.mockResolvedValue(WAV);
    storage.putPublicObject.mockResolvedValue(undefined);
    storage.publicUrl.mockImplementation(
      (key: string) => `https://files.test/${key}`,
    );
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackAudioService,
        { provide: AudioDownloadClient, useValue: downloads },
        { provide: FfmpegClient, useValue: ffmpeg },
        { provide: StorageService, useValue: storage },
        { provide: TrackProcessingRepository, useValue: processings },
      ],
    }).compile();
    service = moduleRef.get(TrackAudioService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe('the first run', () => {
    it('asks RapidAPI to convert the chosen video, and waits one poll for its progress', async () => {
      await expect(service.run(processing(), undefined)).resolves.toEqual({
        kind: 'wait',
        delayMs: 10_000,
        state: { progressUrl: PROGRESS_URL },
      });

      expect(downloads.requestConversion).toHaveBeenCalledWith('aaaaaaaaaaa');
      expect(downloads.checkConversion).not.toHaveBeenCalled();
    });

    it('fails a Processing with no chosen video as an unexpected error, not a download failure', async () => {
      const failure = service.run(processing({ videoId: null }), undefined);

      await expect(failure).rejects.toThrow('has no video to download');
      await expect(failure).rejects.not.toBeInstanceOf(TrackProcessingFailure);
    });

    it('fails with DOWNLOAD_FAILED when RapidAPI refuses the conversion', async () => {
      downloads.requestConversion.mockRejectedValue(
        new Error('RapidAPI answered HTTP 503'),
      );

      await expect(service.run(processing(), undefined)).rejects.toMatchObject(
        expectFailure('DOWNLOAD_FAILED'),
      );
    });
  });

  describe('the re-checks', () => {
    it('checks a conversion still running again, after the same delay, with the same progress URL', async () => {
      await expect(service.run(processing(), waitingAt(1))).resolves.toEqual({
        kind: 'wait',
        delayMs: 10_000,
        state: { progressUrl: PROGRESS_URL },
      });

      expect(downloads.checkConversion).toHaveBeenCalledWith(PROGRESS_URL);
      expect(downloads.downloadMp3).not.toHaveBeenCalled();
    });

    it('waits again on the check before the last one of the budget', async () => {
      await expect(
        service.run(processing(), waitingAt(179)),
      ).resolves.toMatchObject({ kind: 'wait' });
    });

    it('fails with DOWNLOAD_FAILED when the last check of the budget still finds it running', async () => {
      const failure = service.run(processing(), waitingAt(180));

      await expect(failure).rejects.toMatchObject(
        expectFailure('DOWNLOAD_FAILED'),
      );
      await expect(failure).rejects.toBeInstanceOf(TrackProcessingFailure);
      expect(downloads.downloadMp3).not.toHaveBeenCalled();
      expect(storage.putPublicObject).not.toHaveBeenCalled();
    });

    it('stores a conversion that is ready on the last check of the budget', async () => {
      downloads.checkConversion.mockResolvedValue({
        ready: true,
        downloadUrl: DOWNLOAD_URL,
      });

      await expect(service.run(processing(), waitingAt(180))).resolves.toEqual({
        kind: 'done',
      });
    });

    it('fails with DOWNLOAD_FAILED when a check fails, so BullMQ retries it', async () => {
      downloads.checkConversion.mockRejectedValue(new Error('timed out'));

      await expect(
        service.run(processing(), waitingAt(3)),
      ).rejects.toMatchObject(expectFailure('DOWNLOAD_FAILED'));
    });

    it('refuses a re-check whose state is not a progress URL', async () => {
      await expect(
        service.run(processing(), { round: 1, state: { progressUrl: 'nope' } }),
      ).rejects.toThrow();
      expect(downloads.checkConversion).not.toHaveBeenCalled();
    });
  });

  describe('storing the audio', () => {
    beforeEach(() => {
      downloads.checkConversion.mockResolvedValue({
        ready: true,
        downloadUrl: DOWNLOAD_URL,
      });
    });

    it('downloads the MP3, converts it, stores the WAV publicly and saves its URL', async () => {
      await expect(service.run(processing(), waitingAt(2))).resolves.toEqual({
        kind: 'done',
      });

      expect(downloads.downloadMp3).toHaveBeenCalledWith(DOWNLOAD_URL);
      expect(ffmpeg.convertMp3ToWav).toHaveBeenCalledWith(MP3);
      expect(storage.putPublicObject).toHaveBeenCalledWith({
        key: 'track-audio/track-1.wav',
        body: WAV,
        contentType: 'audio/wav',
      });
      expect(processings.saveMusicWavUrl).toHaveBeenCalledWith(
        'processing-1',
        STORED_URL,
      );
      // The object is stored before its URL is saved on the Processing.
      expect(storage.putPublicObject.mock.invocationCallOrder[0]).toBeLessThan(
        processings.saveMusicWavUrl.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it('fails with DOWNLOAD_FAILED when the MP3 cannot be downloaded', async () => {
      downloads.downloadMp3.mockRejectedValue(new Error('HTTP 404'));

      await expect(
        service.run(processing(), waitingAt(2)),
      ).rejects.toMatchObject(expectFailure('DOWNLOAD_FAILED'));
      expect(storage.putPublicObject).not.toHaveBeenCalled();
    });

    it('fails with DOWNLOAD_FAILED when ffmpeg cannot convert the MP3', async () => {
      ffmpeg.convertMp3ToWav.mockRejectedValue(
        new Error('ffmpeg exited with code 1'),
      );

      await expect(
        service.run(processing(), waitingAt(2)),
      ).rejects.toMatchObject(expectFailure('DOWNLOAD_FAILED'));
      expect(storage.putPublicObject).not.toHaveBeenCalled();
    });

    it('lets a storage failure through as it is, not as a download failure', async () => {
      storage.putPublicObject.mockRejectedValue(new Error('S3 is down'));

      const failure = service.run(processing(), waitingAt(2));

      await expect(failure).rejects.toThrow('S3 is down');
      await expect(failure).rejects.not.toBeInstanceOf(TrackProcessingFailure);
      expect(processings.saveMusicWavUrl).not.toHaveBeenCalled();
    });
  });

  describe('a stored audio', () => {
    it('downloads nothing when the Processing already has its WAV, so a replayed step does not download again', async () => {
      processings.findMusicWavUrl.mockResolvedValue(STORED_URL);

      await expect(service.run(processing(), undefined)).resolves.toEqual({
        kind: 'done',
      });
      await expect(service.run(processing(), waitingAt(5))).resolves.toEqual({
        kind: 'done',
      });

      expect(downloads.requestConversion).not.toHaveBeenCalled();
      expect(downloads.checkConversion).not.toHaveBeenCalled();
      expect(downloads.downloadMp3).not.toHaveBeenCalled();
    });
  });
});
