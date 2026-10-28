import { queryOptions } from '@tanstack/react-query';
import {
  type StreakHeartbeatBody,
  streakHeartbeatResultSchema,
  streakStatusSchema,
} from '@vozzify/contracts';

import { browserApi } from '@/lib/api/browser';

import { nextPracticeDayDelay } from './practice-day';
import { streakKeys } from './query-keys';

/** The browser's IANA time zone: the practice day follows it. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Today against the daily target (`GET /v1/me/streak`). It depends on the
 * session, so only a signed-in User asks for it.
 */
export function streakStatusQueryOptions(account?: string) {
  const timeZone = browserTimeZone();
  return queryOptions({
    queryKey: streakKeys.status(timeZone, account),
    queryFn: ({ signal }) =>
      browserApi('/me/streak', {
        schema: streakStatusSchema,
        query: { timeZone },
        signal,
      }),
    // The heartbeats keep it current while the music plays.
    staleTime: 60_000,
    // Refresh the practice day even when the foreground player is paused.
    refetchInterval: () => nextPracticeDayDelay(),
  });
}

/** Credits practice time (`POST /v1/me/streak/heartbeat`). */
export function sendHeartbeat(body: StreakHeartbeatBody) {
  return browserApi('/me/streak/heartbeat', {
    method: 'POST',
    body,
    schema: streakHeartbeatResultSchema,
  });
}
