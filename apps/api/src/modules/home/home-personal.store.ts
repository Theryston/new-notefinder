import { Injectable } from '@nestjs/common';
import type { Locale } from '@notefinder/contracts';
import { CacheService } from '../../redis/cache.service.js';
import {
  type StoredPersonalHomeFeed,
  storedPersonalHomeFeedSchema,
} from './home-feed.js';
import {
  PERSONAL_SNAPSHOT_LOCK_TTL_SECONDS,
  PERSONAL_SNAPSHOT_TTL_SECONDS,
} from './home-rules.js';

/**
 * The key of one snapshot part. The version hashes the User with the rows, so
 * a retired snapshot is keyed by its version alone, like the public ones.
 */
const keysFor = (userId: string, locale: Locale) => ({
  current: `home:personal:${userId}:${locale}:current`,
  lock: `home:personal:${userId}:${locale}:lock`,
});

const retainedKey = (version: string): string =>
  `home:personal:version:${version}`;

/**
 * One User's snapshots, one per locale: the current snapshot and the build
 * lock, plus the snapshots a rebuild replaced (kept for cursors still in
 * flight, by version). Every call goes through the shared cache, which fails
 * open: a Redis outage reads as no snapshot, so the request serves the public
 * feed and queues a rebuild.
 */
@Injectable()
export class PersonalHomeStore {
  constructor(private readonly cache: CacheService) {}

  readCurrent(
    userId: string,
    locale: Locale,
  ): Promise<StoredPersonalHomeFeed | undefined> {
    return this.cache.get(
      keysFor(userId, locale).current,
      storedPersonalHomeFeedSchema,
    );
  }

  writeCurrent(
    userId: string,
    locale: Locale,
    feed: StoredPersonalHomeFeed,
  ): Promise<void> {
    return this.cache.set(
      keysFor(userId, locale).current,
      feed,
      PERSONAL_SNAPSHOT_TTL_SECONDS,
    );
  }

  retire(feed: StoredPersonalHomeFeed): Promise<void> {
    return this.cache.set(
      retainedKey(feed.version),
      feed,
      PERSONAL_SNAPSHOT_TTL_SECONDS,
    );
  }

  readRetired(version: string): Promise<StoredPersonalHomeFeed | undefined> {
    return this.cache.get(retainedKey(version), storedPersonalHomeFeedSchema);
  }

  acquireLock(userId: string, locale: Locale): Promise<boolean> {
    return this.cache.acquire(
      keysFor(userId, locale).lock,
      PERSONAL_SNAPSHOT_LOCK_TTL_SECONDS,
    );
  }

  releaseLock(userId: string, locale: Locale): Promise<void> {
    return this.cache.del(keysFor(userId, locale).lock);
  }
}
