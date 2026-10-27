import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import {
  DELIVER_TRACK_ASSOCIATIONS_JOB,
  type DeliverTrackAssociationsJob,
  deliverTrackAssociationsJobSchema,
  TRACK_ASSOCIATION_POLL_INTERVAL_MS,
  TRACK_ASSOCIATION_QUEUE,
  TRACK_ASSOCIATION_SCHEDULER_ID,
} from './track-association.job.js';
import { TrackAssociationService } from './track-association.service.js';

/** Polls the durable outbox; Redis schedules work but never owns its durability. */
@Processor(TRACK_ASSOCIATION_QUEUE, { concurrency: 1 })
export class TrackAssociationProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(TrackAssociationProcessor.name);

  constructor(
    private readonly associations: TrackAssociationService,
    @InjectQueue(TRACK_ASSOCIATION_QUEUE)
    private readonly queue: Queue<DeliverTrackAssociationsJob>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        TRACK_ASSOCIATION_SCHEDULER_ID,
        { every: TRACK_ASSOCIATION_POLL_INTERVAL_MS },
        { name: DELIVER_TRACK_ASSOCIATIONS_JOB, data: {} },
      );
    } catch (error) {
      this.logger.error(
        'Could not schedule Track association outbox delivery',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async process(job: Job<unknown>): Promise<void> {
    if (
      job.name !== DELIVER_TRACK_ASSOCIATIONS_JOB ||
      !deliverTrackAssociationsJobSchema.safeParse(job.data).success
    ) {
      throw new UnrecoverableError('Invalid Track association job');
    }
    await this.associations.dispatchPending();
  }
}
