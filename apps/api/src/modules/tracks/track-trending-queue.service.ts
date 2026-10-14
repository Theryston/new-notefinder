import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  TRACK_TRENDING_QUEUE,
  trendingJobId,
  UPDATE_TRACK_TRENDING_JOB,
} from './track-views.job.js';

const TRENDING_DELAY_MS = 30_000;

@Injectable()
export class TrackTrendingQueueService {
  constructor(
    @InjectQueue(TRACK_TRENDING_QUEUE)
    private readonly queue: Queue,
  ) {}

  /** Debounce pending recalculations so a burst of views makes one job. */
  async schedule(trackId: string): Promise<void> {
    const id = trendingJobId(trackId);
    const existing = await this.queue.getJob(id);
    let jobId = id;
    if (existing) {
      const state = await existing.getState();
      if (state === 'waiting' || state === 'delayed') {
        await existing.remove();
      } else if (state === 'active') {
        // A view arrived while the previous calculation was already running.
        jobId = `${id}-${Date.now()}`;
      } else {
        await existing.remove();
      }
    }
    await this.queue.add(
      UPDATE_TRACK_TRENDING_JOB,
      { trackId },
      { jobId, delay: TRENDING_DELAY_MS, removeOnComplete: true },
    );
  }
}
