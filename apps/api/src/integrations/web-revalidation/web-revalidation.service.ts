import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  WEB_REVALIDATION_JOB,
  WEB_REVALIDATION_QUEUE,
  type WebRevalidationJob,
  webRevalidationJobSchema,
} from './web-revalidation.job.js';

/**
 * Asks the web app to revalidate cached pages after the data they render
 * changed. Runs in the background with retries, so a slow or briefly
 * unavailable web app never fails the API request that triggered it.
 *
 * Build tags with `cacheTags` from `@notefinder/contracts`, never by hand:
 * `revalidate([cacheTags.track(id), cacheTags.tracks])`.
 */
@Injectable()
export class WebRevalidationService {
  constructor(
    @InjectQueue(WEB_REVALIDATION_QUEUE)
    private readonly queue: Queue<WebRevalidationJob>,
  ) {}

  /** @throws {ZodError} when the (deduplicated) tags break the limits. */
  async revalidate(tags: readonly string[]): Promise<void> {
    const payload = webRevalidationJobSchema.parse({
      tags: [...new Set(tags)],
    });
    await this.queue.add(WEB_REVALIDATION_JOB, payload);
  }
}
