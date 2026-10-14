import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  REFRESH_TRENDING_SCORE_JOB,
  type RefreshTrendingScoreJob,
  TRACK_TRENDING_QUEUE,
  TRENDING_SCORE_DELAY_MS,
  trendingJobId,
} from './track-trending.job.js';

/** Queues the (debounced) recomputation of a Track's trending score. */
@Injectable()
export class TrackTrendingQueueService {
  constructor(
    @InjectQueue(TRACK_TRENDING_QUEUE)
    private readonly queue: Queue<RefreshTrendingScoreJob>,
  ) {}

  /**
   * Schedules the recomputation after the delay unless one already waits for
   * the Track. The job is removed when it ends, so the next view schedules a
   * new one.
   */
  async schedule(trackId: string): Promise<void> {
    await this.queue.add(
      REFRESH_TRENDING_SCORE_JOB,
      { trackId },
      {
        jobId: trendingJobId(trackId),
        delay: TRENDING_SCORE_DELAY_MS,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
