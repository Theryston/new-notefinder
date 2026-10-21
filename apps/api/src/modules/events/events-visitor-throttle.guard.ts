import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT, redisKey } from '../../redis/redis.constants.js';

/** Batches one visitor id may send per minute; mirrors the per-IP budget. */
const VISITOR_LIMIT = 30;
const WINDOW_MS = 60_000;
/** The contract caps the id at 64 chars; the guard runs before validation. */
const MAX_VISITOR_ID_LENGTH = 64;

/** The batch's visitor id, when the raw body carries one. */
const visitorIdOf = (body: unknown): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;
  const visitorId = (body as { visitorId?: unknown }).visitorId;
  if (typeof visitorId !== 'string' || visitorId.length === 0) {
    return undefined;
  }
  return visitorId.slice(0, MAX_VISITOR_ID_LENGTH);
};

/**
 * Per-visitor rate limit for event batches, on top of the per-IP `@Throttle`.
 * A fixed window per visitor id in Redis: one device behind shared Wi-Fi
 * can't spend the whole IP budget, and one abusive id can't flood the queue.
 * Fails open like the other rate limiting, so Redis trouble never 429s.
 */
@Injectable()
export class EventsVisitorThrottleGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ body?: unknown }>();
    const visitorId = visitorIdOf(request.body);
    // No id to key on: invalid batches fail validation with a 400 anyway.
    if (visitorId === undefined) return true;
    const window = Math.floor(Date.now() / WINDOW_MS);
    const key = redisKey('events-visitor', String(window), visitorId);
    let count: number;
    try {
      count = await this.redis.incr(key);
    } catch {
      return true;
    }
    if (count === 1) {
      await this.redis.pexpire(key, WINDOW_MS).catch(() => undefined);
    }
    if (count > VISITOR_LIMIT) throw new ThrottlerException();
    return true;
  }
}
