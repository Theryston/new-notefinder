import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { EventsVisitorThrottleGuard } from './events-visitor-throttle.guard.js';

const contextOf = (body: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  }) as ExecutionContext;

describe('EventsVisitorThrottleGuard', () => {
  const redis = { incr: vi.fn(), pexpire: vi.fn() };
  let guard: EventsVisitorThrottleGuard;

  beforeEach(() => {
    vi.resetAllMocks();
    redis.pexpire.mockResolvedValue(1);
    guard = new EventsVisitorThrottleGuard(redis as never);
  });

  it('lets a batch through under the limit and expires the window key', async () => {
    redis.incr.mockResolvedValue(3);

    await expect(
      guard.canActivate(contextOf({ visitorId: 'v-1' })),
    ).resolves.toBe(true);

    expect(redis.incr).toHaveBeenCalledTimes(1);
    expect(redis.incr.mock.calls[0]?.[0]).toContain('v-1');
    expect(redis.pexpire).not.toHaveBeenCalled();
  });

  it('sets the key expiry on the first batch of the window', async () => {
    redis.incr.mockResolvedValue(1);

    await expect(
      guard.canActivate(contextOf({ visitorId: 'v-1' })),
    ).resolves.toBe(true);

    expect(redis.pexpire).toHaveBeenCalledTimes(1);
  });

  it('allows exactly the limit and rejects the batch above it', async () => {
    redis.incr.mockResolvedValue(30);

    await expect(
      guard.canActivate(contextOf({ visitorId: 'v-1' })),
    ).resolves.toBe(true);

    redis.incr.mockResolvedValue(31);

    await expect(
      guard.canActivate(contextOf({ visitorId: 'v-1' })),
    ).rejects.toBeInstanceOf(ThrottlerException);
  });

  it('skips batches without a visitor id, leaving the 400 to validation', async () => {
    await expect(guard.canActivate(contextOf({}))).resolves.toBe(true);
    await expect(guard.canActivate(contextOf(undefined))).resolves.toBe(true);

    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('fails open when Redis is unreachable', async () => {
    redis.incr.mockRejectedValue(new Error('redis is down'));

    await expect(
      guard.canActivate(contextOf({ visitorId: 'v-1' })),
    ).resolves.toBe(true);
  });
});
