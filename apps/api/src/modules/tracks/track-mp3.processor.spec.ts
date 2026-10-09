import { Test, type TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { TrackMp3Processor } from './track-mp3.processor.js';
import { TrackMp3Service } from './track-mp3.service.js';

// The music MP3 job's decisions: which Processing it stores, and what it does
// with a failure. BullMQ's attempts are the caller's (`finalAttempt`); the
// storage is a fake.

const job = { trackId: 'track-1', processingId: 'processing-1' };

describe('TrackMp3Processor', () => {
  const mp3s = { storeMusicMp3: vi.fn() };
  let processor: TrackMp3Processor;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    mp3s.storeMusicMp3.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackMp3Processor,
        { provide: TrackMp3Service, useValue: mp3s },
      ],
    }).compile();
    processor = moduleRef.get(TrackMp3Processor);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('stores the music MP3 of the Processing the job names', async () => {
    await processor.run(job, true);

    expect(mp3s.storeMusicMp3).toHaveBeenCalledWith({
      id: 'processing-1',
      trackId: 'track-1',
    });
  });

  it('lets BullMQ retry a failure before the last attempt', async () => {
    mp3s.storeMusicMp3.mockRejectedValue(new Error('ffmpeg failed'));

    await expect(processor.run(job, false)).rejects.toThrow('ffmpeg failed');
  });

  it('logs a failure of the last attempt and leaves the Processing as it is', async () => {
    mp3s.storeMusicMp3.mockRejectedValue(new Error('storage is down'));

    await expect(processor.run(job, true)).resolves.toBeUndefined();
  });

  it('refuses a job whose payload breaks its schema, without retrying it', async () => {
    await expect(
      processor.run({ processingId: '' }, true),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(mp3s.storeMusicMp3).not.toHaveBeenCalled();
  });
});
