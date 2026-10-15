import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  REFRESH_SCORED_TRACKS_JOB,
  REFRESH_TRENDING_SCORE_JOB,
  type RefreshTrendingScoreJob,
  SCORED_TRACKS_CRON,
  SCORED_TRACKS_SCHEDULER_ID,
  TRACK_TRENDING_QUEUE,
  TRENDING_SCORE_DELAY_MS,
  trendingJobId,
} from './track-trending.job.js';

/** Queues the (debounced) recomputation of a Track's trending score. */
@Injectable()
export class TrackTrendingQueueService implements OnModuleInit {
  constructor(
    @InjectQueue(TRACK_TRENDING_QUEUE)
    private readonly queue: Queue<
      RefreshTrendingScoreJob | Record<string, never>
    >,
  ) {}

  /** Registers the daily recomputation; upserting is safe on every boot. */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      SCORED_TRACKS_SCHEDULER_ID,
      { pattern: SCORED_TRACKS_CRON, tz: 'UTC' },
      { name: REFRESH_SCORED_TRACKS_JOB, data: {} },
    );
  }

  /**
   * Schedules the recomputation after the delay unless one already waits for
   * the Track in this time slot (see `trendingJobId`). The job is removed when
   * it ends.
   */
  async schedule(trackId: string, now = Date.now()): Promise<void> {
    await this.queue.add(
      REFRESH_TRENDING_SCORE_JOB,
      { trackId },
      {
        jobId: trendingJobId(trackId, now),
        delay: TRENDING_SCORE_DELAY_MS,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
