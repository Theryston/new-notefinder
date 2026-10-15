import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job, UnrecoverableError } from 'bullmq';
import {
  REFRESH_SCORED_TRACKS_JOB,
  REFRESH_TRENDING_SCORE_JOB,
  refreshTrendingScoreJobSchema,
  TRACK_TRENDING_QUEUE,
} from './track-trending.job.js';
import { TrackTrendingService } from './track-trending.service.js';

/** Consumes the trending queue; a failure is retried by BullMQ. */
@Processor(TRACK_TRENDING_QUEUE, { concurrency: 2 })
export class TrackTrendingProcessor extends WorkerHost {
  constructor(private readonly trending: TrackTrendingService) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    if (job.name === REFRESH_SCORED_TRACKS_JOB) {
      await this.trending.refreshScored();
      return;
    }
    const parsed =
      job.name === REFRESH_TRENDING_SCORE_JOB
        ? refreshTrendingScoreJobSchema.safeParse(job.data)
        : undefined;
    if (!parsed?.success) {
      throw new UnrecoverableError('Invalid job');
    }
    await this.trending.refresh(parsed.data.trackId);
  }
}
