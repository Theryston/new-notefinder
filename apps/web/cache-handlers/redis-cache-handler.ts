import { createHash } from 'node:crypto';

import type {
  CacheEntry,
  CacheHandler,
} from 'next/dist/server/lib/cache-handlers/types';

import { LocalTier } from './local-tier.ts';
import { type CacheRedisClient, RedisConnection } from './redis-connection.ts';
import {
  deserialize,
  readStream,
  type StoredEntry,
  serialize,
  toStream,
} from './stored-entry.ts';
import { TagStore, type TagsManifest } from './tag-state.ts';
import { DAY, SECOND } from './time.ts';

export type { CacheRedisClient } from './redis-connection.ts';
export type { TagsManifest } from './tag-state.ts';

export type RedisCacheHandlerOptions = {
  redis: CacheRedisClient;
  /** Shared by every build: tag invalidations must reach old and new builds. */
  keyPrefix: string;
  /** Scopes entries so a deploy never reads another build's serialized data. */
  buildId: string;
  /**
   * Next's global tags manifest in production, so the prerendered-page cache
   * (which reads that manifest) also sees invalidations made on other
   * instances. Tests pass one map per simulated instance.
   */
  tagsManifest: TagsManifest;
  /** Byte budget of the in-process tier. */
  localMaxBytes?: number;
  /** Minimum delay between two tag syncs with Redis. */
  tagsSyncIntervalMs?: number;
  /** Upper bound for any single Redis round trip. */
  operationTimeoutMs?: number;
  /** How long Redis is skipped after a failure before it is tried again. */
  failureCooldownMs?: number;
  /** Minimum delay between two "Redis unavailable" warnings. */
  warnIntervalMs?: number;
  /**
   * How long entries and tag invalidations are kept. Entry TTLs are capped to
   * it, which is what makes dropping older tag invalidations safe: every
   * entry they could invalidate is already gone.
   */
  retentionMs?: number;
  /** Mirrors Next's `__NEXT_DEV_SERVER` branches of the default handler. */
  isDevServer?: boolean;
  now?: () => number;
  warn?: (message: string) => void;
  logError?: (message: string) => void;
};

type EntryStatus = 'fresh' | 'stale' | 'gone';

class RedisCacheHandler {
  readonly tags: TagStore;
  readonly #connection: RedisConnection;
  readonly #local: LocalTier;
  readonly #pendingSets = new Map<string, Promise<void>>();
  readonly #entryKeyPrefix: string;
  readonly #retentionMs: number;
  readonly #isDevServer: boolean;
  readonly #now: () => number;

  constructor(options: RedisCacheHandlerOptions) {
    const {
      now = Date.now,
      retentionMs = 30 * DAY,
      warn = (message: string) => console.warn(message),
      logError = (message: string) => console.error(message),
    } = options;
    this.#connection = new RedisConnection({
      redis: options.redis,
      operationTimeoutMs: options.operationTimeoutMs ?? 500,
      failureCooldownMs: options.failureCooldownMs ?? SECOND,
      warnIntervalMs: options.warnIntervalMs ?? 30 * SECOND,
      now,
      warn,
    });
    this.tags = new TagStore({
      connection: this.#connection,
      manifest: options.tagsManifest,
      keyPrefix: options.keyPrefix,
      retentionMs,
      syncIntervalMs: options.tagsSyncIntervalMs ?? SECOND,
      now,
      logError,
    });
    this.#local = new LocalTier(options.localMaxBytes ?? 32 * 1024 * 1024);
    this.#entryKeyPrefix = `${options.keyPrefix}:${options.buildId}:entry:`;
    this.#retentionMs = retentionMs;
    this.#isDevServer = options.isDevServer ?? false;
    this.#now = now;
  }

  async get(
    cacheKey: string,
    softTags: readonly string[],
  ): Promise<CacheEntry | undefined> {
    const pendingSet = this.#pendingSets.get(cacheKey);
    if (pendingSet !== undefined) await pendingSet;

    const found = await this.#readEntry(cacheKey, softTags, this.#now());
    if (!found) {
      this.#local.delete(cacheKey);
      return undefined;
    }

    const { entry, status } = found;

    return {
      tags: entry.tags,
      stale: entry.stale,
      timestamp: entry.timestamp,
      expire: entry.expire,
      revalidate: status === 'stale' ? -1 : entry.revalidate,
      value: toStream(entry.value),
    };
  }

  async set(cacheKey: string, pendingEntry: Promise<CacheEntry>) {
    let resolvePending = () => {};
    const pending = new Promise<void>((resolve) => {
      resolvePending = resolve;
    });
    this.#pendingSets.set(cacheKey, pending);

    let stored: StoredEntry | undefined;
    try {
      stored = await this.#buffer(await pendingEntry);
      if (stored) this.#local.set(cacheKey, stored);
    } catch {
      // A stream that errored midway would cache a partial render: drop it.
      stored = undefined;
    } finally {
      // Local readers must not wait for the Redis write below.
      resolvePending();
      if (this.#pendingSets.get(cacheKey) === pending) {
        this.#pendingSets.delete(cacheKey);
      }
    }

    if (stored) await this.#writeRemote(cacheKey, stored);
  }

  async #buffer(entry: CacheEntry): Promise<StoredEntry | undefined> {
    // In production an `expire: 0` entry is regenerated on every read, so
    // storing it would be a wasted write (same as the default handler).
    if (!this.#isDevServer && entry.expire === 0) return undefined;
    return {
      value: await readStream(entry.value),
      tags: entry.tags,
      stale: entry.stale,
      timestamp: entry.timestamp,
      expire: entry.expire,
      revalidate: entry.revalidate,
    };
  }

  /**
   * `gone`: must not be served. `stale`: served once more while Next
   * regenerates it (a tag was revalidated with a cache life profile).
   */
  #classify(
    entry: StoredEntry,
    softTags: readonly string[],
    at: number,
  ): EntryStatus {
    const { timestamp } = entry;
    if (
      // Negative `expire` is the dev tiered handler's eviction sentinel.
      entry.expire < 0 ||
      at > timestamp + entry.expire * SECOND ||
      at > timestamp + this.#retentionMs ||
      entry.tags.some((tag) => this.tags.isExpired(tag, timestamp, at)) ||
      softTags.some((tag) => this.tags.isExpired(tag, timestamp, at))
    ) {
      return 'gone';
    }
    return entry.tags.some((tag) => this.tags.isStale(tag, timestamp))
      ? 'stale'
      : 'fresh';
  }

  async #readEntry(
    cacheKey: string,
    softTags: readonly string[],
    at: number,
  ): Promise<{ entry: StoredEntry; status: 'fresh' | 'stale' } | undefined> {
    const cached = this.#local.get(cacheKey);
    const status = cached ? this.#classify(cached, softTags, at) : 'gone';
    if (cached && status === 'fresh') return { entry: cached, status };

    // An invalidated local copy may already have been regenerated by another
    // instance: prefer that over rendering it again here.
    const remote = await this.#readRemote(cacheKey);
    const remoteStatus = remote ? this.#classify(remote, softTags, at) : 'gone';
    if (
      remote &&
      remoteStatus !== 'gone' &&
      (status === 'gone' || (cached && remote.timestamp > cached.timestamp))
    ) {
      this.#local.set(cacheKey, remote);
      return { entry: remote, status: remoteStatus };
    }
    if (cached && status !== 'gone') return { entry: cached, status };
    return undefined;
  }

  // Hashed so arbitrarily long cache keys (they embed serialized arguments)
  // map to short, fixed-size Redis keys.
  #entryKey(cacheKey: string) {
    const hash = createHash('sha256').update(cacheKey).digest('base64url');
    return `${this.#entryKeyPrefix}${hash}`;
  }

  async #readRemote(cacheKey: string) {
    const connection = this.#connection;
    if (!connection.isAvailable()) return undefined;
    try {
      const buffer = await connection.run(
        connection.client.getBuffer(this.#entryKey(cacheKey)),
      );
      return buffer ? deserialize(buffer) : undefined;
    } catch (error) {
      connection.reportFailure('read', error);
      return undefined;
    }
  }

  async #writeRemote(cacheKey: string, entry: StoredEntry) {
    const connection = this.#connection;
    const ttlMs = Math.min(
      entry.timestamp + entry.expire * SECOND - this.#now(),
      this.#retentionMs,
    );
    if (!connection.isAvailable() || !(ttlMs >= 1)) return;
    try {
      await connection.run(
        connection.client.set(
          this.#entryKey(cacheKey),
          serialize(entry),
          'PX',
          Math.ceil(ttlMs),
        ),
      );
    } catch (error) {
      connection.reportFailure('write', error);
    }
  }
}

/**
 * A `'use cache'` handler with two tiers: a byte-bounded in-process LRU in
 * front of Redis, shared by every instance. Tag invalidations are recorded in
 * Redis and synced into the local tags manifest before requests (debounced,
 * incremental), so a `revalidateTag` received by one instance reaches all of
 * them. Every Redis failure degrades to the local tier: it never fails or
 * blocks a render (bounded by `operationTimeoutMs`).
 *
 * Semantics follow Next's default handler
 * (`next/dist/server/lib/cache-handlers/default.js`), except that entries past
 * `revalidate` are still returned until `expire`: unlike an in-memory LRU, a
 * shared store makes stale-while-revalidate worth it (the "use cache" wrapper
 * serves the stale value and regenerates it in the background).
 */
export function createRedisCacheHandler(
  options: RedisCacheHandlerOptions,
): CacheHandler {
  const handler = new RedisCacheHandler(options);
  return {
    get: (cacheKey, softTags) => handler.get(cacheKey, softTags),
    set: (cacheKey, pendingEntry) => handler.set(cacheKey, pendingEntry),
    refreshTags: () => handler.tags.refresh(),
    getExpiration: async (tags) => handler.tags.getExpiration(tags),
    updateTags: (tags, durations) => handler.tags.update(tags, durations),
  };
}
