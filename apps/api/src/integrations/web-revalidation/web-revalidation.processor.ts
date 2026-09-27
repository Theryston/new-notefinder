import { Processor, WorkerHost } from '@nestjs/bullmq';
import { HttpStatus, Inject, Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { ENV, type Env } from '../../config/env.js';
import {
  WEB_REVALIDATION_QUEUE,
  webRevalidationJobSchema,
} from './web-revalidation.job.js';

const REQUEST_TIMEOUT_MS = 10_000;

// Other 4xx (bad secret, invalid body) will fail the same way on every retry.
const isRetryableStatus = (status: number): boolean =>
  status >= 500 ||
  status === HttpStatus.REQUEST_TIMEOUT ||
  status === HttpStatus.TOO_MANY_REQUESTS;

/**
 * POSTs the job's tags to the web's revalidation endpoint. Revalidating a tag
 * twice is harmless, so retries (and duplicate jobs) are safe.
 */
@Processor(WEB_REVALIDATION_QUEUE, { concurrency: 5 })
export class WebRevalidationProcessor extends WorkerHost {
  private readonly logger = new Logger(WebRevalidationProcessor.name);

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const parsed = webRevalidationJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`Invalid job payload (job ${job.id})`);
    }
    const { tags } = parsed.data;

    if (this.env.REVALIDATE_SECRET === undefined) {
      this.logger.warn(
        `REVALIDATE_SECRET is not set, skipping revalidation of ${tags.length} tag(s)`,
      );
      return;
    }

    const response = await fetch(`${this.env.WEB_URL}/api/revalidate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.REVALIDATE_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // Drain the body so the connection can be reused.
    await response.body?.cancel();

    if (!response.ok) {
      const message = `Web revalidation failed with HTTP ${response.status}`;
      throw isRetryableStatus(response.status)
        ? new Error(message)
        : new UnrecoverableError(message);
    }
    this.logger.log(`Revalidated ${tags.length} web cache tag(s)`);
  }
}
