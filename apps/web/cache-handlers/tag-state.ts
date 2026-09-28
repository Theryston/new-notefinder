import { randomUUID } from 'node:crypto';

import type { RedisConnection } from './redis-connection.ts';
import { SECOND } from './time.ts';

/**
 * Tag state in the exact shape of Next's in-process tags manifest
 * (`next/dist/server/lib/incremental-cache/tags-manifest.external`).
 * `stale`: entries created before it are served once more while they are
 * regenerated in the background. `expired`: entries created before it (once
 * that moment has passed) are dropped.
 */
export type TagState = { stale?: number; expired?: number };
export type TagsManifest = Map<string, TagState>;

// Tag invalidations written up to this long before the last sync are fetched
// again, which absorbs clock skew between instances and writes that commit
// out of timestamp order.
const TAG_SYNC_OVERLAP_MS = 60 * SECOND;
const PRUNE_INTERVAL_MS = 60 * 60 * SECOND;

type RemoteTimestamps = readonly (string | null | undefined)[];

export type TagStoreOptions = {
  connection: RedisConnection;
  manifest: TagsManifest;
  keyPrefix: string;
  /** Tag invalidations older than this are pruned from Redis. */
  retentionMs: number;
  /** Minimum delay between two tag syncs with Redis. */
  syncIntervalMs: number;
  now: () => number;
  logError: (message: string) => void;
};

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

const parseTimestamp = (value: string | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Tag invalidations: the local tags manifest plus their shared record in
 * Redis, synced into the manifest before requests (debounced, incremental), so
 * a `revalidateTag` received by one instance reaches all of them.
 */
export class TagStore {
  readonly #options: TagStoreOptions;
  readonly #keys: {
    stale: string;
    expired: string;
    log: string;
    version: string;
  };
  #version: string | null | undefined;
  #lastSyncAt = Number.NEGATIVE_INFINITY;
  #syncedUntil = 0;
  #pendingSync: Promise<void> | undefined;
  #lastPruneAt = 0;

  constructor(options: TagStoreOptions) {
    this.#options = options;
    const { keyPrefix } = options;
    this.#keys = {
      stale: `${keyPrefix}:tags:stale`,
      expired: `${keyPrefix}:tags:expired`,
      log: `${keyPrefix}:tags:log`,
      version: `${keyPrefix}:tags:version`,
    };
  }

  isExpired(tag: string, timestamp: number, at: number): boolean {
    const expiredAt = this.#options.manifest.get(tag)?.expired;
    return expiredAt !== undefined && expiredAt <= at && expiredAt > timestamp;
  }

  isStale(tag: string, timestamp: number): boolean {
    const staleAt = this.#options.manifest.get(tag)?.stale ?? 0;
    return staleAt > timestamp;
  }

  getExpiration(tags: readonly string[]): number {
    let expiration = 0;
    for (const tag of tags) {
      expiration = Math.max(
        expiration,
        this.#options.manifest.get(tag)?.expired ?? 0,
      );
    }
    return expiration;
  }

  async refresh(): Promise<void> {
    const { connection, now, syncIntervalMs } = this.#options;
    // Concurrent requests share the in-flight sync (bounded by the Redis
    // timeout) rather than rendering with tag state it is about to update.
    if (this.#pendingSync !== undefined) return this.#pendingSync;
    const startedAt = now();
    if (
      startedAt - this.#lastSyncAt < syncIntervalMs ||
      !connection.isAvailable()
    ) {
      return;
    }
    this.#lastSyncAt = startedAt;
    this.#pendingSync = this.#sync(startedAt)
      .catch((error: unknown) => connection.reportFailure('tag sync', error))
      .finally(() => {
        this.#pendingSync = undefined;
      });
    await this.#pendingSync;
  }

  async update(
    tags: readonly string[],
    durations?: { expire?: number },
  ): Promise<void> {
    if (tags.length === 0) return;
    const { connection, now, logError } = this.#options;
    const at = now();
    const times = tagUpdateTimes(at, durations);
    this.#updateLocal(tags, times);

    try {
      await connection.exec(this.#updateCommands(tags, at, times));
    } catch (error) {
      connection.reportFailure('tag update', error);
      // Next only logs errors thrown here (the revalidation request still
      // succeeds), so report it loudly and unthrottled: other instances keep
      // serving these tags until the next successful invalidation.
      logError(
        `[cache] Tags invalidated on this instance only (Redis unavailable): ${tags.join(', ')}`,
      );
      return;
    }

    try {
      await this.#prune(at);
    } catch (error) {
      connection.reportFailure('tag prune', error);
    }
  }

  async #sync(startedAt: number) {
    const { connection } = this.#options;
    const version = await connection.run(
      connection.client.get(this.#keys.version),
    );
    if (version === this.#version) return;

    // `null`: no tag was ever invalidated, so there is nothing to load.
    if (version !== null) {
      if (this.#version === undefined) {
        await this.#loadAll();
      } else {
        await this.#loadSince(this.#syncedUntil - TAG_SYNC_OVERLAP_MS);
      }
    }
    // The version was read before the data, so a write racing this sync bumps
    // it again and is picked up by the next one.
    this.#version = version;
    this.#syncedUntil = startedAt;
  }

  /**
   * First sync of this process: every tag invalidation still within retention
   * (bounded by pruning). Later syncs only load the recent ones.
   */
  async #loadAll() {
    const { connection } = this.#options;
    const [stale, expired] = await connection.run(
      Promise.all([
        connection.client.hgetall(this.#keys.stale),
        connection.client.hgetall(this.#keys.expired),
      ]),
    );
    const tags = [...new Set([...Object.keys(stale), ...Object.keys(expired)])];
    this.#applyRemote(
      tags,
      tags.map((tag) => stale[tag]),
      tags.map((tag) => expired[tag]),
    );
  }

  async #loadSince(since: number) {
    const { connection } = this.#options;
    const tags = await connection.run(
      connection.client.zrangebyscore(this.#keys.log, since, '+inf'),
    );
    if (tags.length === 0) return;
    const [stale, expired] = await connection.run(
      Promise.all([
        connection.client.hmget(this.#keys.stale, ...tags),
        connection.client.hmget(this.#keys.expired, ...tags),
      ]),
    );
    this.#applyRemote(tags, stale, expired);
  }

  #applyRemote(
    tags: readonly string[],
    stale: RemoteTimestamps,
    expired: RemoteTimestamps,
  ) {
    const { manifest } = this.#options;
    tags.forEach((tag, index) => {
      const staleAt = parseTimestamp(stale[index]);
      const expiredAt = parseTimestamp(expired[index]);
      if (staleAt === undefined && expiredAt === undefined) return;
      // Redis is last-write-wins per field, like the manifest itself: a later
      // immediate expiration must be able to replace a far-future one.
      const state: TagState = { ...manifest.get(tag) };
      if (staleAt !== undefined) state.stale = staleAt;
      if (expiredAt !== undefined) state.expired = expiredAt;
      manifest.set(tag, state);
    });
  }

  /** Same update as the default handler, so this instance sees it at once. */
  #updateLocal(tags: readonly string[], times: TagState) {
    const { manifest } = this.#options;
    for (const tag of tags) {
      const state: TagState = { ...manifest.get(tag) };
      if (times.stale !== undefined) state.stale = times.stale;
      if (times.expired !== undefined) state.expired = times.expired;
      manifest.set(tag, state);
    }
  }

  #updateCommands(
    tags: readonly string[],
    at: number,
    { stale, expired }: TagState,
  ): (string | number)[][] {
    const commands: (string | number)[][] = [];
    if (stale !== undefined) {
      commands.push([
        'hset',
        this.#keys.stale,
        ...tags.flatMap((tag) => [tag, stale]),
      ]);
    }
    if (expired !== undefined) {
      commands.push([
        'hset',
        this.#keys.expired,
        ...tags.flatMap((tag) => [tag, expired]),
      ]);
    }
    commands.push(
      ['zadd', this.#keys.log, ...tags.flatMap((tag) => [at, tag])],
      // A unique token rather than a counter: after a Redis restart or flush
      // a counter would restart at a value instances have already seen.
      ['set', this.#keys.version, `${at}:${randomUUID()}`],
    );
    return commands;
  }

  async #prune(at: number) {
    if (at - this.#lastPruneAt < PRUNE_INTERVAL_MS) return;
    this.#lastPruneAt = at;
    const { connection, retentionMs } = this.#options;
    const old = await connection.run(
      connection.client.zrangebyscore(this.#keys.log, '-inf', at - retentionMs),
    );
    if (old.length > 0) {
      await connection.exec([
        ['hdel', this.#keys.stale, ...old],
        ['hdel', this.#keys.expired, ...old],
        ['zrem', this.#keys.log, ...old],
      ]);
    }
  }
}
