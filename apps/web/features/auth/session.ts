import { queryOptions } from '@tanstack/react-query';

import { loadAuthClient } from './auth-client';
import { authKeys } from './query-keys';

/** The signed-in user as Better Auth reports it, or `null` when signed out. */
export function sessionUserOptions() {
  return queryOptions({
    queryKey: authKeys.session(),
    queryFn: async () => {
      const { data, error } = await (await loadAuthClient()).getSession();
      if (error) throw new Error(error.message ?? 'Session lookup failed');
      return data?.user ?? null;
    },
    retry: false,
  });
}
