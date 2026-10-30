import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { OnModuleInit } from '@nestjs/common';
import { type Job, type Queue, UnrecoverableError } from 'bullmq';
import { PRICE_CHANGE_JOB, PRICE_CHANGE_QUEUE } from './price-change.job.js';
import { PriceChangeReconcileService } from './price-change-reconcile.service.js';
import { PriceChangesService } from './price-changes.service.js';

@Processor(PRICE_CHANGE_QUEUE, { concurrency: 1 })
export class PriceChangeProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly changes: PriceChangesService,
    private readonly reconciliation: PriceChangeReconcileService,
    @InjectQueue(PRICE_CHANGE_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'subscription-price-changes',
      { every: 60_000 },
      { name: PRICE_CHANGE_JOB, data: {} },
    );
  }

  async process(job: Job<unknown>) {
    if (job.name !== PRICE_CHANGE_JOB)
      throw new UnrecoverableError('Invalid price change job');
    await this.reconciliation.processPending();
    await this.changes.processPending();
  }
}
