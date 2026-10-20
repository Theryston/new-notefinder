import { Injectable, Logger } from '@nestjs/common';
import { cacheTags, LOCALES, type Locale } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { minimalHomeFeed, type StoredHomeFeed } from './home-feed.js';
import { HomeFeedStore } from './home-feed.store.js';
import { HomeFeedBuilder } from './home-feed-builder.service.js';
import { DEFAULT_HOME_LOCALE } from './home-rules.js';

export type CurrentPublicFeed = {
  feed: StoredHomeFeed;
  /** False for the fallback home, which no cache may keep. */
  cacheable: boolean;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Owns the public feeds' lifecycle, one per locale. The request path only
 * reads them: a missing feed is built by one request under a lock, and the
 * others get the minimal home. The hourly job and the boot warm-up call
 * `refreshPublic`, which revalidates a locale's web tag only when its content
 * changed.
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
   * Builds one locale's public feed and commits it. A changed feed is
   * revalidated before it is stored: if the revalidation cannot be queued the
   * call fails with nothing stored, so the retry still sees a change and
   * revalidates. Storing first would make the retry see an unchanged feed, and
   * the web would never be revalidated. The revalidation is only queued here;
   * the web fetches the feed when the job runs, a moment after the commit.
   */
  async refreshPublic(
    locale: Locale = DEFAULT_HOME_LOCALE,
  ): Promise<StoredHomeFeed> {
    const next = await this.builder.build(locale);
    const current = await this.store.readCurrent(locale);
    if (current?.version === next.version) {
      await this.store.writeCurrent(locale, next);
      return next;
    }
    await this.revalidation.revalidate([cacheTags.home(locale)]);
    await this.commit(locale, current, next);
    return next;
  }

  /** The feed a request serves: the stored one, or one built under the lock. */
  async currentPublic(locale: Locale): Promise<CurrentPublicFeed> {
    const current = await this.store.readCurrent(locale);
    if (current) {
      return { feed: current, cacheable: true };
    }
    if (!(await this.store.acquireLock(locale))) {
      return { feed: minimalHomeFeed(), cacheable: false };
    }
    try {
      return { feed: await this.buildUnderLock(locale), cacheable: true };
    } finally {
      await this.store.releaseLock(locale);
    }
  }

  /**
   * The feed a cursor names: the current feed of any locale, or a version
   * retained for about 30 minutes after it was replaced. Undefined when the
   * version is gone. Versions are hashes that include the locale, so the
   * version alone names the feed.
   */
  async publicVersion(version: string): Promise<StoredHomeFeed | undefined> {
    const current = await this.findCurrentByVersion(version);
    if (current) {
      return current;
    }
    return this.store.readRetired(version);
  }

  private async findCurrentByVersion(
    version: string,
  ): Promise<StoredHomeFeed | undefined> {
    for (const locale of LOCALES) {
      const feed = await this.store.readCurrent(locale);
      if (feed?.version === version) {
        return feed;
      }
    }
    return undefined;
  }

  /**
   * Best effort on purpose: a request that builds the missing feed still
   * answers when the web can't be revalidated right now. The feed is stored
   * and the error is logged; the web catches up on the next content change or
   * when its own cache entry expires. Only the hourly job retries, and it
   * revalidates only on change, so this path does not feed that retry.
   */
  private async buildUnderLock(locale: Locale): Promise<StoredHomeFeed> {
    const next = await this.builder.build(locale);
    const current = await this.store.readCurrent(locale);
    await this.commit(locale, current, next);
    if (current?.version !== next.version) {
      await this.revalidation
        .revalidate([cacheTags.home(locale)])
        .catch((error: unknown) =>
          this.logger.error(`Home revalidation failed: ${errorMessage(error)}`),
        );
    }
    return next;
  }

  /**
   * Stores `next` as the locale's current feed. A replaced feed stays reachable
   * for the cursors still in flight.
   */
  private async commit(
    locale: Locale,
    current: StoredHomeFeed | undefined,
    next: StoredHomeFeed,
  ): Promise<void> {
    if (current && current.version !== next.version) {
      await this.store.retire(current);
    }
    await this.store.writeCurrent(locale, next);
  }
}
