import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Locale } from '@vozzify/contracts';
import { LOCALES } from '@vozzify/contracts';
import { type Job, type Queue, UnrecoverableError } from 'bullmq';
import {
  HOME_FEED_QUEUE,
  PUBLIC_HOME_FEED_CRON,
  PUBLIC_HOME_FEED_SCHEDULER_ID,
  REFRESH_PUBLIC_HOME_FEED_JOB,
} from './home-feed.job.js';
import { HomeFeedService } from './home-feed.service.js';

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Refreshes every locale's feed on its own: one locale failing does not hold
 * back the others. Rejects when any failed, so the job is retried; the locales
 * that succeeded revalidate nothing on the retry, since their content is
 * unchanged.
 */
const refreshEveryLocale = async (feeds: HomeFeedService): Promise<void> => {
  const results = await Promise.allSettled(
    LOCALES.map((locale: Locale) => feeds.refreshPublic(locale)),
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failure) {
    throw new Error(
      `Home feed refresh failed: ${errorMessage(failure.reason)}`,
    );
  }
};

/**
 * Regenerates the public home feed hourly, and once on boot so the first
 * visitor never waits for it. Idempotent: an unchanged feed is not revalidated.
 */
@Processor(HOME_FEED_QUEUE, { concurrency: 1 })
export class HomeFeedProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(HomeFeedProcessor.name);

  constructor(
    private readonly feeds: HomeFeedService,
    @InjectQueue(HOME_FEED_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      PUBLIC_HOME_FEED_SCHEDULER_ID,
      { pattern: PUBLIC_HOME_FEED_CRON, tz: 'UTC' },
      { name: REFRESH_PUBLIC_HOME_FEED_JOB, data: {} },
    );
    // Awaited, so the feeds are in Redis before the app reports ready. A failure
    // is logged, not fatal: the first request builds the feed under the lock.
    try {
      await refreshEveryLocale(this.feeds);
    } catch (error) {
      this.logger.error(
        `Boot warm-up of the home feed failed: ${errorMessage(error)}`,
      );
    }
  }

  async process(job: Job<unknown>): Promise<void> {
    if (job.name !== REFRESH_PUBLIC_HOME_FEED_JOB) {
      throw new UnrecoverableError('Unknown home feed job');
    }
    await refreshEveryLocale(this.feeds);
  }
}
