import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import {
  EVENTS_QUEUE,
  STORE_EVENTS_JOB,
  storeEventsJobSchema,
} from './events.job.js';
import { EventsRepository } from './events.repository.js';

/**
 * Stores queued event batches in the monthly-partitioned table, one `INSERT`
 * per batch. Idempotent: a retried batch replays the same rows, and an
 * invalid payload is rejected without retrying.
 */
@Processor(EVENTS_QUEUE, { concurrency: 2 })
export class EventsProcessor extends WorkerHost {
  constructor(private readonly repository: EventsRepository) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    if (job.name !== STORE_EVENTS_JOB) {
      throw new UnrecoverableError('Unknown events job');
    }
    const parsed = storeEventsJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError('Invalid events job');
    }
    await this.repository.insertMany(parsed.data);
  }
}
