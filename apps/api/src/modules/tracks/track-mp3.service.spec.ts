import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import { FfmpegClient } from '../../integrations/ffmpeg/ffmpeg.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { TRACK_MP3_QUEUE } from './track-mp3.job.js';
import { TrackMp3Service } from './track-mp3.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';

// The MP3 decisions: which WAV converts, where the MP3 is stored, when a run
// converts nothing, and what the music job is queued with. ffmpeg, the storage,
// the queue and the rows are fakes.

const WAV = new Uint8Array([82, 73, 70, 70]) as Uint8Array<ArrayBuffer>;
const MP3 = new Uint8Array([255, 251, 144, 0]) as Uint8Array<ArrayBuffer>;
const STORED = new Uint8Array([7, 7]) as Uint8Array<ArrayBuffer>;

const processing = { id: 'processing-1', trackId: 'track-1' };

const storedAudio = (overrides: Record<string, string | null> = {}) => ({
  musicWavUrl: 'https://files.test/track-audio/track-1/processing-1.wav',
  musicMp3Url: null,
  vocalsWavUrl: 'https://files.test/track-vocals/track-1/processing-1.wav',
  vocalsMp3Url: null,
  ...overrides,
});

const VOCALS_MP3_KEY = 'track-vocals/track-1/processing-1.mp3';
const MUSIC_MP3_KEY = 'track-audio/track-1/processing-1.mp3';

describe('TrackMp3Service', () => {
  const ffmpeg = { convertWavToMp3: vi.fn() };
  const storage = {
    objectExists: vi.fn(),
    downloadPublicObject: vi.fn(),
    putPublicObject: vi.fn(),
    publicUrl: vi.fn(),
  };
  const processings = {
    findAudioUrls: vi.fn(),
    saveMp3Url: vi.fn(),
  };
  const queue = { add: vi.fn() };
  let service: TrackMp3Service;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    ffmpeg.convertWavToMp3.mockResolvedValue(MP3);
    storage.objectExists.mockResolvedValue(false);
    storage.downloadPublicObject.mockResolvedValue(WAV);
    storage.publicUrl.mockImplementation(
      (key: string) => `https://files.test/${key}`,
    );
    processings.findAudioUrls.mockResolvedValue(storedAudio());
    queue.add.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackMp3Service,
        { provide: FfmpegClient, useValue: ffmpeg },
        { provide: StorageService, useValue: storage },
        { provide: TrackProcessingRepository, useValue: processings },
        { provide: getQueueToken(TRACK_MP3_QUEUE), useValue: queue },
      ],
    }).compile();
    service = moduleRef.get(TrackMp3Service);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('queues the music MP3 as a job of its own, keyed by its Processing', async () => {
    await service.queueMusicMp3(processing);

    expect(queue.add).toHaveBeenCalledWith(
      'store-music-mp3',
      { trackId: 'track-1', processingId: 'processing-1' },
      { jobId: 'music-mp3-processing-1' },
    );
  });

  it('converts the vocals WAV to MP3, stores it publicly and saves its URL', async () => {
    const bytes = await service.storeVocalsMp3(processing);

    expect(storage.downloadPublicObject).toHaveBeenCalledWith(
      'https://files.test/track-vocals/track-1/processing-1.wav',
    );
    expect(ffmpeg.convertWavToMp3).toHaveBeenCalledWith(WAV);
    expect(storage.putPublicObject).toHaveBeenCalledWith({
      key: VOCALS_MP3_KEY,
      body: MP3,
      contentType: 'audio/mpeg',
    });
    expect(processings.saveMp3Url).toHaveBeenCalledWith(
      'processing-1',
      'vocals',
      `https://files.test/${VOCALS_MP3_KEY}`,
    );
    expect(bytes).toEqual(MP3);
  });

  it('stores the music MP3 beside its WAV and reads nothing back for it', async () => {
    await service.storeMusicMp3(processing);

    expect(storage.downloadPublicObject).toHaveBeenCalledTimes(1);
    expect(storage.downloadPublicObject).toHaveBeenCalledWith(
      'https://files.test/track-audio/track-1/processing-1.wav',
    );
    expect(storage.putPublicObject).toHaveBeenCalledWith({
      key: MUSIC_MP3_KEY,
      body: MP3,
      contentType: 'audio/mpeg',
    });
    expect(processings.saveMp3Url).toHaveBeenCalledWith(
      'processing-1',
      'music',
      `https://files.test/${MUSIC_MP3_KEY}`,
    );
  });

  it('converts nothing again for an MP3 an earlier run saved, and reads it from its URL', async () => {
    const savedUrl = `https://files.test/${VOCALS_MP3_KEY}`;
    processings.findAudioUrls.mockResolvedValue(
      storedAudio({ vocalsMp3Url: savedUrl }),
    );
    storage.downloadPublicObject.mockResolvedValue(STORED);

    const bytes = await service.storeVocalsMp3(processing);

    expect(ffmpeg.convertWavToMp3).not.toHaveBeenCalled();
    expect(storage.putPublicObject).not.toHaveBeenCalled();
    expect(storage.downloadPublicObject).toHaveBeenCalledWith(savedUrl);
    expect(bytes).toEqual(STORED);
  });

  it('saves the URL of an MP3 already in storage without converting it again', async () => {
    storage.objectExists.mockResolvedValue(true);

    await service.storeVocalsMp3(processing);

    expect(storage.objectExists).toHaveBeenCalledWith(VOCALS_MP3_KEY);
    expect(ffmpeg.convertWavToMp3).not.toHaveBeenCalled();
    expect(processings.saveMp3Url).toHaveBeenCalledWith(
      'processing-1',
      'vocals',
      `https://files.test/${VOCALS_MP3_KEY}`,
    );
  });

  it('fails when the WAV of the MP3 is not stored yet, so nothing is converted', async () => {
    processings.findAudioUrls.mockResolvedValue(
      storedAudio({ vocalsWavUrl: null }),
    );

    await expect(service.storeVocalsMp3(processing)).rejects.toThrow(
      'Processing processing-1 has no vocals WAV to convert',
    );
    expect(ffmpeg.convertWavToMp3).not.toHaveBeenCalled();
  });
});
