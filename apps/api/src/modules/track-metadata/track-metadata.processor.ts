import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { isFinalAttempt } from '../../queue/job-attempts.js';
import {
  importMetadataJobSchema,
  TRACK_METADATA_QUEUE,
} from '../../queue/track-metadata.job.js';
import { TrackMetadataService } from './track-metadata.service.js';

/** Consumes the metadata queue: each job is one import attempt, run by the service. */
@Processor(TRACK_METADATA_QUEUE, { concurrency: 2 })
export class TrackMetadataProcessor extends WorkerHost {
  constructor(private readonly metadata: TrackMetadataService) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const parsed = importMetadataJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError('Invalid job payload');
    }
    return this.metadata.run(parsed.data, isFinalAttempt(job));
  }
}
