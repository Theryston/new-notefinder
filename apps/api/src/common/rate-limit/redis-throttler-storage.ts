import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { redisKey } from '../../redis/redis.constants.js';

/**
 * Fixed-window counter plus a block key, updated atomically. Once the limit is
 * exceeded the tracker is blocked for `blockDuration` and its window resets,
 * matching the semantics of the in-memory `ThrottlerStorageService`.
 * Returns `{ totalHits, windowTtlMs, isBlocked (0|1), blockTtlMs }`.
 */
const INCREMENT_SCRIPT = `
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  return { limit + 1, blockTtl, 1, blockTtl }
end

local hits = redis.call('INCR', KEYS[1])
local hitsTtl = redis.call('PTTL', KEYS[1])
if hitsTtl < 0 then
  redis.call('PEXPIRE', KEYS[1], ttl)
  hitsTtl = ttl
end

if hits > limit then
  if blockDuration > 0 then
    redis.call('SET', KEYS[2], '1', 'PX', blockDuration)
    redis.call('DEL', KEYS[1])
    return { hits, blockDuration, 1, blockDuration }
  end
  return { hits, hitsTtl, 1, hitsTtl }
end
return { hits, hitsTtl, 0, 0 }
`;

const scriptResultSchema = z.tuple([
  z.number(),
  z.number(),
  z.union([z.literal(0), z.literal(1)]),
  z.number(),
]);

// Not exported by `@nestjs/throttler`'s entry point.
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

const WARN_INTERVAL_MS = 10_000;

const toSeconds = (milliseconds: number): number =>
  Math.max(0, Math.ceil(milliseconds / 1000));

/**
 * `@nestjs/throttler` storage on Redis, so every API instance shares the same
 * counters. Written in-house because `@nest-lab/throttler-storage-redis`
 * doesn't support NestJS 12 yet.
 *
 * Fails open: if Redis is unreachable the request is allowed (and a warning
 * logged at most every 10s), since an outage of the limiter shouldn't take the
 * whole API down with it.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private lastWarnAt = 0;

  constructor(private readonly redis: Redis) {}

  // biome-ignore lint/complexity/useMaxParams: the signature is @nestjs/throttler's ThrottlerStorage interface.
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // The hash tag keeps both keys in the same slot on a Redis Cluster.
    const base = redisKey('throttler', `{${throttlerName}:${key}}`);
    try {
      const result: unknown = await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        `${base}:hits`,
        `${base}:blocked`,
        ttl,
        limit,
        blockDuration,
      );
      const [totalHits, windowTtl, isBlocked, blockTtl] =
        scriptResultSchema.parse(result);
      return {
        totalHits,
        timeToExpire: toSeconds(windowTtl),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: toSeconds(blockTtl),
      };
    } catch (error) {
      this.warnFailOpen(error);
      return {
        totalHits: 0,
        timeToExpire: toSeconds(ttl),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  private warnFailOpen(error: unknown): void {
    const now = Date.now();
    if (now - this.lastWarnAt < WARN_INTERVAL_MS) {
      return;
    }
    this.lastWarnAt = now;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Rate limiting disabled, Redis failed: ${message}`);
  }
}
