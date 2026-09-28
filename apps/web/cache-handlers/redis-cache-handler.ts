import { createHash, randomUUID } from 'node:crypto';

import type {
  CacheEntry,
  CacheHandler,
} from 'next/dist/server/lib/cache-handlers/types';

/**
 * Tag state in the exact shape of Next's in-process tags manifest
 * (`next/dist/server/lib/incremental-cache/tags-manifest.external`).
 * `stale`: entries created before it are served once more while they are
 * regenerated in the background. `expired`: entries created before it (once
 * that moment has passed) are dropped.
 */
export type TagState = { stale?: number; expired?: number };
export type TagsManifest = Map<string, TagState>;

type ExecResult = [error: Error | null, result: unknown][] | null;

/**
 * The subset of ioredis this handler uses, so tests can swap in an in-memory
 * fake. Every method rejects (never hangs forever) when Redis is unreachable
 * because the real client is created with `enableOfflineQueue: false`.
 */
export type CacheRedisClient = {
  getBuffer(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer, mode: 'PX', ttlMs: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hmget(key: string, ...fields: string[]): Promise<(string | null)[]>;
  zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]>;
  multi(commands: (string | number)[][]): { exec(): Promise<ExecResult> };
};

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

type StoredEntry = {
  value: Uint8Array;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
};

const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;
// Tag invalidations written up to this long before the last sync are fetched
// again, which absorbs clock skew between instances and writes that commit
// out of timestamp order.
const TAG_SYNC_OVERLAP_MS = 60 * SECOND;
const PRUNE_INTERVAL_MS = 60 * 60 * SECOND;

/** Byte-bounded LRU of fully buffered entries (the in-process tier). */
class LocalTier {
  readonly #entries = new Map<string, { entry: StoredEntry; size: number }>();
  readonly #maxBytes: number;
  #bytes = 0;

  constructor(maxBytes: number) {
    this.#maxBytes = maxBytes;
  }

  get(key: string): StoredEntry | undefined {
    const item = this.#entries.get(key);
    if (!item) return undefined;
    // Re-insert to mark it as the most recently used.
    this.#entries.delete(key);
    this.#entries.set(key, item);
    return item.entry;
  }

  set(key: string, entry: StoredEntry): void {
    this.delete(key);
    const size = entry.value.byteLength + key.length;
    if (size > this.#maxBytes) return;
    this.#entries.set(key, { entry, size });
    this.#bytes += size;
    for (const [oldestKey] of this.#entries) {
      if (this.#bytes <= this.#maxBytes) break;
      this.delete(oldestKey);
    }
  }

  delete(key: string): void {
    const item = this.#entries.get(key);
    if (!item) return;
    this.#entries.delete(key);
    this.#bytes -= item.size;
  }
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function toStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      // A copy, so a consumer can never mutate the cached bytes.
      controller.enqueue(bytes.slice());
      controller.close();
    },
  });
}

// JSON has no Infinity: a non-finite duration is stored as null.
const encodeDuration = (value: number) =>
  Number.isFinite(value) ? value : null;
const decodeDuration = (value: unknown) =>
  typeof value === 'number' ? value : Number.POSITIVE_INFINITY;

/** `[u32 meta length][meta JSON][raw bytes]`: no base64 inflation. */
function serialize(entry: StoredEntry): Buffer {
  const meta = Buffer.from(
    JSON.stringify({
      tags: entry.tags,
      stale: encodeDuration(entry.stale),
      timestamp: entry.timestamp,
      expire: encodeDuration(entry.expire),
      revalidate: encodeDuration(entry.revalidate),
    }),
  );
  const header = Buffer.alloc(4);
  header.writeUInt32BE(meta.byteLength);
  return Buffer.concat([header, meta, entry.value]);
}

function deserialize(buffer: Buffer): StoredEntry | undefined {
  if (buffer.byteLength < 4) return undefined;
  const metaLength = buffer.readUInt32BE(0);
  if (4 + metaLength > buffer.byteLength) return undefined;
  const meta: unknown = JSON.parse(
    buffer.subarray(4, 4 + metaLength).toString(),
  );
  if (
    typeof meta !== 'object' ||
    meta === null ||
    !('tags' in meta) ||
    !Array.isArray(meta.tags) ||
    !meta.tags.every((tag) => typeof tag === 'string') ||
    !('timestamp' in meta) ||
    typeof meta.timestamp !== 'number' ||
    !('stale' in meta) ||
    !('expire' in meta) ||
    !('revalidate' in meta)
  ) {
    return undefined;
  }
  return {
    // Copy out of the (possibly pooled) response buffer.
    value: new Uint8Array(buffer.subarray(4 + metaLength)),
    tags: meta.tags,
    stale: decodeDuration(meta.stale),
    timestamp: meta.timestamp,
    expire: decodeDuration(meta.expire),
    revalidate: decodeDuration(meta.revalidate),
  };
}

/**
 * With `durations` the tags were revalidated with a cache life profile: stale
 * now, expired only after `durations.expire` (if set). Without it they expire
 * now.
 */
function tagUpdateTimes(at: number, durations?: { expire?: number }): TagState {
  if (!durations) return { expired: at };
  return {
    stale: at,
    expired:
      durations.expire === undefined
        ? undefined
        : at + durations.expire * SECOND,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis operation timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const parseTimestamp = (value: string | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

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
  const {
    redis,
    keyPrefix,
    buildId,
    tagsManifest,
    localMaxBytes = 32 * 1024 * 1024,
    tagsSyncIntervalMs = SECOND,
    operationTimeoutMs = 500,
    failureCooldownMs = SECOND,
    warnIntervalMs = 30 * SECOND,
    retentionMs = 30 * DAY,
    isDevServer = false,
    now = Date.now,
    warn = (message: string) => console.warn(message),
    logError = (message: string) => console.error(message),
  } = options;

  const keys = {
    // Hashed so arbitrarily long cache keys (they embed serialized arguments)
    // map to short, fixed-size Redis keys.
    entry: (cacheKey: string) =>
      `${keyPrefix}:${buildId}:entry:${createHash('sha256').update(cacheKey).digest('base64url')}`,
    tagsStale: `${keyPrefix}:tags:stale`,
    tagsExpired: `${keyPrefix}:tags:expired`,
    tagsLog: `${keyPrefix}:tags:log`,
    tagsVersion: `${keyPrefix}:tags:version`,
  };

  const local = new LocalTier(localMaxBytes);
  const pendingSets = new Map<string, Promise<void>>();

  let unavailableUntil = 0;
  let lastWarnAt = Number.NEGATIVE_INFINITY;
  let suppressedWarnings = 0;

  let tagsVersion: string | null | undefined;
  let lastTagSyncAt = Number.NEGATIVE_INFINITY;
  let tagSyncedUntil = 0;
  let pendingTagSync: Promise<void> | undefined;
  let lastPruneAt = 0;

  const isRedisAvailable = () => now() >= unavailableUntil;

  function reportFailure(operation: string, error: unknown) {
    const at = now();
    unavailableUntil = at + failureCooldownMs;
    if (at - lastWarnAt < warnIntervalMs) {
      suppressedWarnings += 1;
      return;
    }
    const reason = error instanceof Error ? error.message : String(error);
    const suppressed =
      suppressedWarnings > 0
        ? ` (${suppressedWarnings} similar warnings suppressed)`
        : '';
    warn(
      `[cache] Redis ${operation} failed, using the in-process cache only: ${reason}${suppressed}`,
    );
    lastWarnAt = at;
    suppressedWarnings = 0;
  }

  async function exec(commands: (string | number)[][]) {
    const results = await withTimeout(
      redis.multi(commands).exec(),
      operationTimeoutMs,
    );
    if (results === null) throw new Error('Redis transaction was aborted');
    for (const [error] of results) {
      if (error) throw error;
    }
  }

  function isTagExpired(tag: string, timestamp: number, at: number) {
    const expiredAt = tagsManifest.get(tag)?.expired;
    return expiredAt !== undefined && expiredAt <= at && expiredAt > timestamp;
  }

  function isTagStale(tag: string, timestamp: number) {
    const staleAt = tagsManifest.get(tag)?.stale ?? 0;
    return staleAt > timestamp;
  }

  /**
   * `gone`: must not be served. `stale`: served once more while Next
   * regenerates it (a tag was revalidated with a cache life profile).
   */
  function classify(
    entry: StoredEntry,
    softTags: readonly string[],
    at: number,
  ): 'fresh' | 'stale' | 'gone' {
    const { timestamp } = entry;
    if (
      // Negative `expire` is the dev tiered handler's eviction sentinel.
      entry.expire < 0 ||
      at > timestamp + entry.expire * SECOND ||
      at > timestamp + retentionMs ||
      entry.tags.some((tag) => isTagExpired(tag, timestamp, at)) ||
      softTags.some((tag) => isTagExpired(tag, timestamp, at))
    ) {
      return 'gone';
    }
    return entry.tags.some((tag) => isTagStale(tag, timestamp))
      ? 'stale'
      : 'fresh';
  }

  async function readRemote(cacheKey: string) {
    if (!isRedisAvailable()) return undefined;
    try {
      const buffer = await withTimeout(
        redis.getBuffer(keys.entry(cacheKey)),
        operationTimeoutMs,
      );
      return buffer ? deserialize(buffer) : undefined;
    } catch (error) {
      reportFailure('read', error);
      return undefined;
    }
  }

  async function writeRemote(cacheKey: string, entry: StoredEntry) {
    const ttlMs = Math.min(
      entry.timestamp + entry.expire * SECOND - now(),
      retentionMs,
    );
    if (!isRedisAvailable() || !(ttlMs >= 1)) return;
    try {
      await withTimeout(
        redis.set(
          keys.entry(cacheKey),
          serialize(entry),
          'PX',
          Math.ceil(ttlMs),
        ),
        operationTimeoutMs,
      );
    } catch (error) {
      reportFailure('write', error);
    }
  }

  function applyRemoteTags(
    tags: readonly string[],
    stale: readonly (string | null | undefined)[],
    expired: readonly (string | null | undefined)[],
  ) {
    tags.forEach((tag, index) => {
      const staleAt = parseTimestamp(stale[index]);
      const expiredAt = parseTimestamp(expired[index]);
      if (staleAt === undefined && expiredAt === undefined) return;
      // Redis is last-write-wins per field, like the manifest itself: a later
      // immediate expiration must be able to replace a far-future one.
      const state: TagState = { ...tagsManifest.get(tag) };
      if (staleAt !== undefined) state.stale = staleAt;
      if (expiredAt !== undefined) state.expired = expiredAt;
      tagsManifest.set(tag, state);
    });
  }

  async function syncTags(startedAt: number) {
    const version = await withTimeout(
      redis.get(keys.tagsVersion),
      operationTimeoutMs,
    );
    if (version === tagsVersion) return;

    if (version === null) {
      // No tag was ever invalidated: nothing to load.
    } else if (tagsVersion === undefined) {
      // First sync of this process: load every tag invalidation still within
      // retention (bounded by pruning), then only the recent ones.
      const [stale, expired] = await withTimeout(
        Promise.all([
          redis.hgetall(keys.tagsStale),
          redis.hgetall(keys.tagsExpired),
        ]),
        operationTimeoutMs,
      );
      const tags = [
        ...new Set([...Object.keys(stale), ...Object.keys(expired)]),
      ];
      applyRemoteTags(
        tags,
        tags.map((tag) => stale[tag]),
        tags.map((tag) => expired[tag]),
      );
    } else {
      const tags = await withTimeout(
        redis.zrangebyscore(
          keys.tagsLog,
          tagSyncedUntil - TAG_SYNC_OVERLAP_MS,
          '+inf',
        ),
        operationTimeoutMs,
      );
      if (tags.length > 0) {
        const [stale, expired] = await withTimeout(
          Promise.all([
            redis.hmget(keys.tagsStale, ...tags),
            redis.hmget(keys.tagsExpired, ...tags),
          ]),
          operationTimeoutMs,
        );
        applyRemoteTags(tags, stale, expired);
      }
    }
    // The version was read before the data, so a write racing this sync bumps
    // it again and is picked up by the next one.
    tagsVersion = version;
    tagSyncedUntil = startedAt;
  }

  async function readEntry(
    cacheKey: string,
    softTags: readonly string[],
    at: number,
  ): Promise<{ entry: StoredEntry; status: 'fresh' | 'stale' } | undefined> {
    const cached = local.get(cacheKey);
    const status = cached ? classify(cached, softTags, at) : 'gone';
    if (cached && status === 'fresh') return { entry: cached, status };

    // An invalidated local copy may already have been regenerated by another
    // instance: prefer that over rendering it again here.
    const remote = await readRemote(cacheKey);
    const remoteStatus = remote ? classify(remote, softTags, at) : 'gone';
    if (
      remote &&
      remoteStatus !== 'gone' &&
      (status === 'gone' || (cached && remote.timestamp > cached.timestamp))
    ) {
      local.set(cacheKey, remote);
      return { entry: remote, status: remoteStatus };
    }
    if (cached && status !== 'gone') return { entry: cached, status };
    return undefined;
  }

  /** Same update as the default handler, so this instance sees it at once. */
  function updateLocalTags(tags: readonly string[], times: TagState) {
    for (const tag of tags) {
      const state: TagState = { ...tagsManifest.get(tag) };
      if (times.stale !== undefined) state.stale = times.stale;
      if (times.expired !== undefined) state.expired = times.expired;
      tagsManifest.set(tag, state);
    }
  }

  function tagUpdateCommands(
    tags: readonly string[],
    at: number,
    { stale, expired }: TagState,
  ): (string | number)[][] {
    const commands: (string | number)[][] = [];
    if (stale !== undefined) {
      commands.push([
        'hset',
        keys.tagsStale,
        ...tags.flatMap((tag) => [tag, stale]),
      ]);
    }
    if (expired !== undefined) {
      commands.push([
        'hset',
        keys.tagsExpired,
        ...tags.flatMap((tag) => [tag, expired]),
      ]);
    }
    commands.push(
      ['zadd', keys.tagsLog, ...tags.flatMap((tag) => [at, tag])],
      // A unique token rather than a counter: after a Redis restart or flush
      // a counter would restart at a value instances have already seen.
      ['set', keys.tagsVersion, `${at}:${randomUUID()}`],
    );
    return commands;
  }

  async function pruneTags(at: number) {
    if (at - lastPruneAt < PRUNE_INTERVAL_MS) return;
    lastPruneAt = at;
    const cutoff = at - retentionMs;
    const old = await withTimeout(
      redis.zrangebyscore(keys.tagsLog, '-inf', cutoff),
      operationTimeoutMs,
    );
    if (old.length > 0) {
      await exec([
        ['hdel', keys.tagsStale, ...old],
        ['hdel', keys.tagsExpired, ...old],
        ['zrem', keys.tagsLog, ...old],
      ]);
    }
  }

  return {
    async get(cacheKey, softTags) {
      const pendingSet = pendingSets.get(cacheKey);
      if (pendingSet !== undefined) await pendingSet;

      const found = await readEntry(cacheKey, softTags, now());
      if (!found) {
        local.delete(cacheKey);
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
    },

    async set(cacheKey, pendingEntry) {
      let resolvePending = () => {};
      const pending = new Promise<void>((resolve) => {
        resolvePending = resolve;
      });
      pendingSets.set(cacheKey, pending);

      let stored: StoredEntry | undefined;
      try {
        const entry: CacheEntry = await pendingEntry;
        // In production an `expire: 0` entry is regenerated on every read, so
        // storing it would be a wasted write (same as the default handler).
        if (!isDevServer && entry.expire === 0) return;
        const value = await readStream(entry.value);
        stored = {
          value,
          tags: entry.tags,
          stale: entry.stale,
          timestamp: entry.timestamp,
          expire: entry.expire,
          revalidate: entry.revalidate,
        };
        local.set(cacheKey, stored);
      } catch {
        // A stream that errored midway would cache a partial render: drop it.
        stored = undefined;
      } finally {
        // Local readers must not wait for the Redis write below.
        resolvePending();
        if (pendingSets.get(cacheKey) === pending) pendingSets.delete(cacheKey);
      }

      if (stored) await writeRemote(cacheKey, stored);
    },

    async refreshTags() {
      // Concurrent requests share the in-flight sync (bounded by the Redis
      // timeout) rather than rendering with tag state it is about to update.
      if (pendingTagSync !== undefined) return pendingTagSync;
      const startedAt = now();
      if (
        startedAt - lastTagSyncAt < tagsSyncIntervalMs ||
        !isRedisAvailable()
      ) {
        return;
      }
      lastTagSyncAt = startedAt;
      pendingTagSync = syncTags(startedAt)
        .catch((error: unknown) => reportFailure('tag sync', error))
        .finally(() => {
          pendingTagSync = undefined;
        });
      await pendingTagSync;
    },

    async getExpiration(tags) {
      let expiration = 0;
      for (const tag of tags) {
        expiration = Math.max(expiration, tagsManifest.get(tag)?.expired ?? 0);
      }
      return expiration;
    },

    async updateTags(tags, durations) {
      if (tags.length === 0) return;
      const at = now();
      const times = tagUpdateTimes(at, durations);
      updateLocalTags(tags, times);
      const commands = tagUpdateCommands(tags, at, times);

      try {
        await exec(commands);
      } catch (error) {
        reportFailure('tag update', error);
        // Next only logs errors thrown here (the revalidation request still
        // succeeds), so report it loudly and unthrottled: other instances keep
        // serving these tags until the next successful invalidation.
        logError(
          `[cache] Tags invalidated on this instance only (Redis unavailable): ${tags.join(', ')}`,
        );
        return;
      }

      try {
        await pruneTags(at);
      } catch (error) {
        reportFailure('tag prune', error);
      }
    },
  };
}
