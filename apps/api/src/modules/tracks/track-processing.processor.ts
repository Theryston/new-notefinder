import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { TrackJobRunnerService } from './track-job-runner.service.js';
import { TRACK_PROCESSING_QUEUE } from './track-processing.job.js';

/** Consumes the Processing queue: every job is run by the job runner. */
@Processor(TRACK_PROCESSING_QUEUE, { concurrency: 5 })
export class TrackProcessingProcessor extends WorkerHost {
  constructor(private readonly runner: TrackJobRunnerService) {
    super();
  }

  process(job: Job<unknown>): Promise<void> {
    return this.runner.run(job.name, job.data, isFinalAttempt(job));
  }
}

/** Whether BullMQ stops retrying this job when the current attempt throws. */
export const isFinalAttempt = (job: Job<unknown>): boolean =>
  job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
