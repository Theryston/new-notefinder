import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import {
  REFRESH_TRENDING_SCORE_JOB,
  TRACK_TRENDING_QUEUE,
  TRENDING_SCORE_DELAY_MS,
} from './track-trending.job.js';
import { TrackTrendingQueueService } from './track-trending-queue.service.js';

const queue = { add: vi.fn() };

describe('TrackTrendingQueueService', () => {
  let service: TrackTrendingQueueService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackTrendingQueueService,
        { provide: getQueueToken(TRACK_TRENDING_QUEUE), useValue: queue },
      ],
    }).compile();
    service = moduleRef.get(TrackTrendingQueueService);
  });

  it('queues a delayed job keyed by the Track, so views in the delay share it', async () => {
    await service.schedule('track-1');

    expect(queue.add).toHaveBeenCalledWith(
      REFRESH_TRENDING_SCORE_JOB,
      { trackId: 'track-1' },
      expect.objectContaining({
        jobId: 'track-trending-track-1',
        delay: TRENDING_SCORE_DELAY_MS,
        // Kept after it ends, the key would block every later schedule.
        removeOnComplete: true,
        removeOnFail: true,
      }),
    );
  });

  it('keys different Tracks apart', async () => {
    await service.schedule('track-1');
    await service.schedule('track-2');

    const ids = queue.add.mock.calls.map((call) => call[2].jobId);
    expect(new Set(ids).size).toBe(2);
  });
});
