import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import { streakKeys } from './query-keys';
import {
  browserTimeZone,
  sendHeartbeat,
  streakStatusQueryOptions,
} from './streak-queries';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const STATUS = {
  day: '2026-03-10',
  listenedSeconds: 30,
  targetSeconds: 300,
  completedToday: false,
  currentStreakDays: 2,
};

describe('browserTimeZone', () => {
  it('is a zone the API accepts', () => {
    expect(
      () => new Intl.DateTimeFormat('en-US', { timeZone: browserTimeZone() }),
    ).not.toThrow();
  });

  it('falls back to UTC when the browser reports none', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: '' }),
        }) as Intl.DateTimeFormat,
    );

    expect(browserTimeZone()).toBe('UTC');
  });
});

describe('streakStatusQueryOptions', () => {
  beforeEach(() => {
    vi.mocked(browserApi).mockResolvedValue(STATUS);
  });

  it('reads the status under the streak key, in the browser zone', async () => {
    const options = streakStatusQueryOptions();
    const signal = new AbortController().signal;

    expect(options.queryKey).toEqual(streakKeys.status());
    const queryFn = options.queryFn;
    if (typeof queryFn !== 'function') throw new Error('no query function');
    await expect(
      queryFn({ signal } as Parameters<typeof queryFn>[0]),
    ).resolves.toEqual(STATUS);
    expect(browserApi).toHaveBeenCalledWith(
      '/me/streak',
      expect.objectContaining({
        query: { timeZone: browserTimeZone() },
        signal,
      }),
    );
  });
});

describe('sendHeartbeat', () => {
  it('posts the elapsed seconds and the zone', async () => {
    const result = { status: STATUS, justCompleted: false, creditedSeconds: 5 };
    vi.mocked(browserApi).mockResolvedValue(result);

    await expect(
      sendHeartbeat({ elapsedSeconds: 5, timeZone: 'UTC' }),
    ).resolves.toEqual(result);
    expect(browserApi).toHaveBeenCalledWith(
      '/me/streak/heartbeat',
      expect.objectContaining({
        method: 'POST',
        body: { elapsedSeconds: 5, timeZone: 'UTC' },
      }),
    );
  });
});
