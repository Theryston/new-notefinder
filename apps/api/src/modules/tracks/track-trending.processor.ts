import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { TrackViewRepository } from './track-view.repository.js';
import {
  TRACK_TRENDING_QUEUE,
  updateTrackTrendingJobSchema,
} from './track-views.job.js';
import { trendingScore } from './trending-score.js';

@Processor(TRACK_TRENDING_QUEUE, { concurrency: 5 })
export class TrackTrendingProcessor extends WorkerHost {
  constructor(private readonly views: TrackViewRepository) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const { trackId } = updateTrackTrendingJobSchema.parse(job.data);
    const stats = await this.views.findStats(trackId, new Date());
    await this.views.updateTrendingScore(trackId, trendingScore(stats));
  }
}
