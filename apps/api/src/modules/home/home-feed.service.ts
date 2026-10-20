import { Injectable, Logger } from '@nestjs/common';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { minimalHomeFeed, type StoredHomeFeed } from './home-feed.js';
import { HomeFeedStore } from './home-feed.store.js';
import { HomeFeedBuilder } from './home-feed-builder.service.js';

export type CurrentPublicFeed = {
  feed: StoredHomeFeed;
  /** False for the fallback home, which no cache may keep. */
  cacheable: boolean;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Owns the public feed's lifecycle. The request path only reads it: a missing
 * feed is built by one request under a lock, and the others get the minimal
 * home. The hourly job and the boot warm-up call `refreshPublic`, which
 * revalidates the web only when the content changed.
 */
@Injectable()
export class HomeFeedService {
  private readonly logger = new Logger(HomeFeedService.name);

  constructor(
    private readonly store: HomeFeedStore,
    private readonly builder: HomeFeedBuilder,
    private readonly revalidation: WebRevalidationService,
  ) {}

  /**
   * Builds the public feed and commits it. A changed feed is revalidated before
   * it is stored: if the revalidation cannot be queued the call fails with
   * nothing stored, so the retry still sees a change and revalidates. Storing
   * first would make the retry see an unchanged feed, and the web would never
   * be revalidated. The revalidation is only queued here; the web fetches the
   * feed when the job runs, a moment after the commit below.
   */
  async refreshPublic(): Promise<StoredHomeFeed> {
    const next = await this.builder.build();
    const current = await this.store.readCurrent();
    if (current?.version === next.version) {
      await this.store.writeCurrent(next);
      return next;
    }
    await this.revalidation.revalidate([cacheTags.home]);
    await this.commit(current, next);
    return next;
  }

  /** The feed a request serves: the stored one, or one built under the lock. */
  async currentPublic(): Promise<CurrentPublicFeed> {
    const current = await this.store.readCurrent();
    if (current) {
      return { feed: current, cacheable: true };
    }
    if (!(await this.store.acquireLock())) {
      return { feed: minimalHomeFeed(), cacheable: false };
    }
    try {
      return { feed: await this.buildUnderLock(), cacheable: true };
    } finally {
      await this.store.releaseLock();
    }
  }

  /**
   * The feed a cursor names: the current one, or a version retained for about
   * 30 minutes after it was replaced. Undefined when the version is gone.
   */
  async publicVersion(version: string): Promise<StoredHomeFeed | undefined> {
    const current = await this.store.readCurrent();
    if (current?.version === version) {
      return current;
    }
    return this.store.readRetired(version);
  }

  /**
   * Best effort on purpose: a request that builds the missing feed still
   * answers when the web can't be revalidated right now. The feed is stored
   * and the error is logged; the web catches up on the next content change or
   * when its own cache entry expires. Only the hourly job retries, and it
   * revalidates only on change, so this path does not feed that retry.
   */
  private async buildUnderLock(): Promise<StoredHomeFeed> {
    const next = await this.builder.build();
    const current = await this.store.readCurrent();
    await this.commit(current, next);
    if (current?.version !== next.version) {
      await this.revalidation
        .revalidate([cacheTags.home])
        .catch((error: unknown) =>
          this.logger.error(`Home revalidation failed: ${errorMessage(error)}`),
        );
    }
    return next;
  }

  /**
   * Stores `next` as the current feed. A replaced feed stays reachable for the
   * cursors still in flight.
   */
  private async commit(
    current: StoredHomeFeed | undefined,
    next: StoredHomeFeed,
  ): Promise<void> {
    if (current && current.version !== next.version) {
      await this.store.retire(current);
    }
    await this.store.writeCurrent(next);
  }
}
