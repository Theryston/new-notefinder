import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';
import { CacheService } from './cache.service.js';
import { REDIS_CLIENT } from './redis.constants.js';

const logger = new Logger('Redis');

const createRedisClient = (env: Env): Redis => {
  const client = new Redis(env.REDIS_URL, {
    // Connect on the first command, so booting (and tests that never touch
    // Redis) doesn't depend on Redis being up.
    lazyConnect: true,
    // Cache and rate limiting fail open: give up fast instead of stalling
    // requests while Redis is unreachable.
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    commandTimeout: 2000,
  });
  client.on('error', (error: Error) => {
    logger.error(`Connection error: ${error.message}`);
  });
  return client;
};

/**
 * Shared Redis client for cache and rate limiting. BullMQ opens its own
 * connections (workers need blocking ones with different retry settings).
 */
@Global()
@Module({
  providers: [
    { provide: REDIS_CLIENT, inject: [ENV], useFactory: createRedisClient },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
      return;
    }
    this.redis.disconnect();
  }
}
