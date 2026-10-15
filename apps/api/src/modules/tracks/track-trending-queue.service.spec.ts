import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import {
  REFRESH_SCORED_TRACKS_JOB,
  REFRESH_TRENDING_SCORE_JOB,
  SCORED_TRACKS_CRON,
  SCORED_TRACKS_SCHEDULER_ID,
  TRACK_TRENDING_QUEUE,
  TRENDING_SCORE_DELAY_MS,
} from './track-trending.job.js';
import { TrackTrendingQueueService } from './track-trending-queue.service.js';

const queue = { add: vi.fn(), upsertJobScheduler: vi.fn() };

const idOf = (call: number) => queue.add.mock.calls[call]?.[2].jobId;

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

  it('queues a delayed job for the Track, removed when it ends', async () => {
    await service.schedule('track-1', 0);

    expect(queue.add).toHaveBeenCalledWith(
      REFRESH_TRENDING_SCORE_JOB,
      { trackId: 'track-1' },
      expect.objectContaining({
        delay: TRENDING_SCORE_DELAY_MS,
        // Kept after it ends, the key would block a later schedule.
        removeOnComplete: true,
        removeOnFail: true,
      }),
    );
  });

  it('shares one job between the views of a time slot', async () => {
    await service.schedule('track-1', 1000);
    await service.schedule('track-1', TRENDING_SCORE_DELAY_MS - 1);

    expect(idOf(0)).toBe(idOf(1));
  });

  it('gives a view of the next time slot a job of its own, even while the last one runs', async () => {
    await service.schedule('track-1', TRENDING_SCORE_DELAY_MS - 1);
    await service.schedule('track-1', TRENDING_SCORE_DELAY_MS);

    expect(idOf(0)).not.toBe(idOf(1));
  });

  it('keys different Tracks apart', async () => {
    await service.schedule('track-1', 0);
    await service.schedule('track-2', 0);

    expect(idOf(0)).not.toBe(idOf(1));
  });

  it('registers the daily recomputation on boot', async () => {
    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      SCORED_TRACKS_SCHEDULER_ID,
      { pattern: SCORED_TRACKS_CRON, tz: 'UTC' },
      { name: REFRESH_SCORED_TRACKS_JOB, data: {} },
    );
  });
});
