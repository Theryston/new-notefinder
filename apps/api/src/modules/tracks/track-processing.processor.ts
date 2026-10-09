import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { isFinalAttempt } from '../../queue/job-attempts.js';
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
