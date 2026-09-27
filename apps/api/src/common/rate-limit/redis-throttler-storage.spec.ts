import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler-storage.js';

describe('RedisThrottlerStorage', () => {
  const evalMock = vi.fn();
  const storage = new RedisThrottlerStorage({
    eval: evalMock,
  } as unknown as Redis);

  beforeEach(() => {
    evalMock.mockReset();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the script on namespaced keys and converts ms to seconds', async () => {
    evalMock.mockResolvedValue([3, 59_001, 0, 0]);

    await expect(
      storage.increment('hash', 60_000, 120, 60_000, 'default'),
    ).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'notefinder:throttler:{default:hash}:hits',
      'notefinder:throttler:{default:hash}:blocked',
      60_000,
      120,
      60_000,
    );
  });

  it('reports blocked trackers', async () => {
    evalMock.mockResolvedValue([121, 30_000, 1, 30_000]);

    await expect(
      storage.increment('hash', 60_000, 120, 60_000, 'default'),
    ).resolves.toMatchObject({ isBlocked: true, timeToBlockExpire: 30 });
  });

  it('fails open when Redis errors', async () => {
    evalMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      storage.increment('hash', 60_000, 120, 60_000, 'default'),
    ).resolves.toEqual({
      totalHits: 0,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('fails open on an unexpected script result', async () => {
    evalMock.mockResolvedValue('nonsense');

    await expect(
      storage.increment('hash', 60_000, 120, 60_000, 'default'),
    ).resolves.toMatchObject({ isBlocked: false });
  });
});
