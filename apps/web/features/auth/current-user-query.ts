import { currentUserSchema } from '@notefinder/contracts';
import { queryOptions } from '@tanstack/react-query';

import { browserApi } from '@/lib/api/browser';

import { authKeys } from './query-keys';

/**
 * The signed-in user as the database keeps them (`GET /v1/me`), the source
 * of truth for fields that may have changed since sign-in. The edit form
 * pre-fills the Daily target from it; the Name and Avatar come from the
 * session, like the rest of the page.
 */
export function currentUserQueryOptions() {
  return queryOptions({
    queryKey: authKeys.currentUser(),
    queryFn: ({ signal }) =>
      browserApi('/me', { schema: currentUserSchema, signal }),
    // The profile changes rarely, and a save refreshes this from its answer.
    staleTime: 5 * 60_000,
    retry: false,
  });
}
