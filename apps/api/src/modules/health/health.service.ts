import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants.js';
import { HealthRepository } from './health.repository.js';
import type { HealthCheckStatus, Readiness } from './health.schemas.js';

/**
 * Upper bound for each dependency check. Readiness probes run every few
 * seconds and have their own timeout, so a hanging dependency must report
 * `error` quickly instead of stalling the probe.
 */
export const HEALTH_CHECK_TIMEOUT_MS = 2000;

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly healthRepository: HealthRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async readiness(): Promise<Readiness> {
    const [database, redis] = await Promise.all([
      this.check('database', () => this.healthRepository.ping()),
      this.check('redis', () => this.redis.ping()),
    ]);
    return {
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'error',
      checks: { database, redis },
    };
  }

  private async check(
    name: string,
    probe: () => Promise<unknown>,
  ): Promise<HealthCheckStatus> {
    try {
      await withTimeout(probe(), HEALTH_CHECK_TIMEOUT_MS);
      return 'ok';
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Readiness check "${name}" failed: ${reason}`);
      return 'error';
    }
  }
}
