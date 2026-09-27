import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { REDIS_CLIENT } from '../../redis/redis.constants.js';
import { HealthRepository } from './health.repository.js';
import { HEALTH_CHECK_TIMEOUT_MS, HealthService } from './health.service.js';

describe('HealthService', () => {
  let health: HealthService;
  const repository = { ping: vi.fn() };
  const redis = { ping: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    repository.ping.mockResolvedValue(undefined);
    redis.ping.mockResolvedValue('PONG');
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: HealthRepository, useValue: repository },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    health = moduleRef.get(HealthService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is ok when every dependency answers', async () => {
    await expect(health.readiness()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok', redis: 'ok' },
    });
  });

  it('reports each failing dependency', async () => {
    repository.ping.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(health.readiness()).resolves.toEqual({
      status: 'error',
      checks: { database: 'error', redis: 'ok' },
    });

    repository.ping.mockResolvedValue(undefined);
    redis.ping.mockRejectedValue(new Error('Connection is closed'));
    await expect(health.readiness()).resolves.toEqual({
      status: 'error',
      checks: { database: 'ok', redis: 'error' },
    });
  });

  it('fails a check that hangs past the timeout', async () => {
    vi.useFakeTimers();
    redis.ping.mockReturnValue(new Promise(() => undefined));
    const readiness = health.readiness();
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);
    await expect(readiness).resolves.toEqual({
      status: 'error',
      checks: { database: 'ok', redis: 'error' },
    });
  });
});
