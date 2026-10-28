import { queryOptions } from '@tanstack/react-query';
import { asDailyPracticeTargetSeconds } from '@vozzify/contracts/daily-target-rules';

import { authKeys } from './query-keys';

/** The stored Daily target, as the database keeps it. */
export type StoredDailyTarget = {
  dailyPracticeTargetSeconds: number | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * The signed-in user's stored Daily target (`GET /v1/me`), the source of
 * truth for a choice that may have changed since sign-in. The edit form
 * pre-fills from it; the Name and Avatar come from the session, like the
 * rest of the page.
 *
 * Parsed by hand and fetched with a plain request: browserApi parses through
 * the contracts barrel, which would pull Zod into the page's first-load
 * JavaScript (see features/auth/session.ts). Only the target is read, so a
 * newer response shape still pre-fills.
 */
export function currentUserQueryOptions() {
  return queryOptions({
    queryKey: authKeys.currentUser(),
    queryFn: async ({ signal }): Promise<StoredDailyTarget> => {
      const { getClientEnv } = await import('@/lib/env/client');
      const apiUrl = getClientEnv().NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/v1/me`, {
        credentials: 'include',
        signal,
      });
      if (!response.ok) {
        throw new Error(`Daily target lookup failed (${response.status})`);
      }
      const body: unknown = await response.json();
      const stored = isRecord(body) ? body.dailyPracticeTargetSeconds : null;
      return {
        dailyPracticeTargetSeconds: asDailyPracticeTargetSeconds(
          typeof stored === 'number' ? stored : null,
        ),
      };
    },
    // The profile changes rarely, and a save refreshes this from its answer.
    staleTime: 5 * 60_000,
    retry: false,
  });
}
