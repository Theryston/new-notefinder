import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../../config/env.js';
import { REDIS_CLIENT } from '../../redis/redis.constants.js';
import { RedisThrottlerStorage } from './redis-throttler-storage.js';

/**
 * Global rate limit per client IP (`req.ip`, which honours `TRUST_PROXY`),
 * shared by all instances through Redis. Routes opt out with
 * `@SkipThrottle()` or tighten it with `@Throttle({ default: { … } })`.
 * Exceeding it throws a 429, which the global filter maps to `RATE_LIMITED`.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ENV, REDIS_CLIENT],
      useFactory: (env: Env, redis: Redis) => ({
        throttlers: [
          {
            ttl: seconds(env.RATE_LIMIT_TTL_SECONDS),
            limit: env.RATE_LIMIT_MAX,
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
