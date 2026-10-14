import { Processor, WorkerHost } from '@nestjs/bullmq';
import { type Job, UnrecoverableError } from 'bullmq';
import {
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
    const parsed = refreshTrendingScoreJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError('Invalid job payload');
    }
    await this.trending.refresh(parsed.data.trackId);
  }
}
