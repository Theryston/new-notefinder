import { isValidUsername } from '@notefinder/contracts/auth-rules';
import { queryOptions } from '@tanstack/react-query';

import { loadAuthClient } from './auth-client';
import { authKeys } from './query-keys';

/**
 * Whether `username` is free, asked only once it passes the contract (the
 * API would reject it anyway). The API lowercases usernames, so the check
 * does too.
 */
export function usernameAvailabilityOptions(username: string) {
  const normalized = username.trim().toLowerCase();
  return queryOptions({
    queryKey: authKeys.usernameAvailability(normalized),
    queryFn: async ({ signal }) => {
      const client = await loadAuthClient();
      const { data, error } = await client.isUsernameAvailable(
        { username: normalized },
        { signal },
      );
      if (error) throw new Error(error.message ?? 'Availability check failed');
      return data.available;
    },
    enabled: isValidUsername(normalized),
    staleTime: 30_000,
    retry: false,
  });
}
