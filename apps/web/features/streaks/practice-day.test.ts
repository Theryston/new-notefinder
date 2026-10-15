import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import { nextPracticeDayDelay } from './practice-day';
import { streakStatusQueryOptions } from './streak-queries';

// QueryObserver schedules browser polling only in a browser environment.
vi.hoisted(() => vi.stubGlobal('window', {}));

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const yesterday = {
  day: '2026-10-14',
  listenedSeconds: 300,
  targetSeconds: 300,
  completedToday: true,
  currentStreakDays: 2,
};

describe('account-specific practice status', () => {
  it('fetches the next account instead of returning a fresh previous-account cache', async () => {
    const client = new QueryClient();
    vi.mocked(browserApi).mockResolvedValueOnce(yesterday);
    await client.fetchQuery(streakStatusQueryOptions('a@example.com'));
    const today = {
      ...yesterday,
      listenedSeconds: 0,
      targetSeconds: 900,
      completedToday: false,
    };
    vi.mocked(browserApi).mockResolvedValueOnce(today);
    expect(
      await client.fetchQuery(streakStatusQueryOptions('b@example.com')),
    ).toEqual(today);
    expect(browserApi).toHaveBeenCalledTimes(2);
    client.clear();
  });
});

describe('local midnight refresh', () => {
  it.each([
    ['America/Sao_Paulo', '2026-10-15T02:59:58Z', 2_000],
    ['Asia/Tokyo', '2026-10-14T14:59:59Z', 1_000],
    ['America/New_York', '2026-03-08T05:00:00Z', 23 * 3_600_000],
    ['America/New_York', '2026-11-01T04:00:00Z', 25 * 3_600_000],
  ])('schedules the next day in %s at %s', (zone, date, expected) => {
    expect(nextPracticeDayDelay(new Date(date), zone)).toBe(expected);
  });

  it('refreshes yesterday to today at midnight without playback', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 23, 59, 58));
    const client = new QueryClient();
    const today = {
      ...yesterday,
      day: '2026-10-15',
      listenedSeconds: 0,
      completedToday: false,
    };
    vi.mocked(browserApi)
      .mockResolvedValueOnce(yesterday)
      .mockResolvedValueOnce(today);
    const observer = new QueryObserver(
      client,
      streakStatusQueryOptions('a@example.com'),
    );
    const unsubscribe = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(observer.getCurrentResult().data).toEqual(yesterday);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(observer.getCurrentResult().data).toEqual(today);
    unsubscribe();
    client.clear();
    vi.useRealTimers();
  });
});
