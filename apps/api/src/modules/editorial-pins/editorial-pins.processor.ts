import { Processor, WorkerHost } from '@nestjs/bullmq';
import { cacheTags } from '@vozzify/contracts';
import { type Job, UnrecoverableError } from 'bullmq';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import {
  EDITORIAL_PIN_QUEUE,
  INVALIDATE_HOME_FOR_PIN_JOB,
  invalidateHomeForPinJobSchema,
} from './editorial-pins.job.js';

/**
 * Revalidates the home of the locales a pin starts or ends in, at the moment
 * the job runs. Idempotent: revalidating twice changes nothing.
 */
@Processor(EDITORIAL_PIN_QUEUE, { concurrency: 2 })
export class EditorialPinsProcessor extends WorkerHost {
  constructor(private readonly revalidation: WebRevalidationService) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    if (job.name !== INVALIDATE_HOME_FOR_PIN_JOB) {
      throw new UnrecoverableError('Unknown editorial pin job');
    }
    const parsed = invalidateHomeForPinJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError('Invalid editorial pin job');
    }
    await this.revalidation.revalidate(
      parsed.data.locales.map((locale) => cacheTags.home(locale)),
    );
  }
}
