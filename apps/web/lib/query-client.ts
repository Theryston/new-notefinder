import {
  defaultShouldDehydrateQuery,
  environmentManager,
  QueryClient,
} from '@tanstack/react-query';

import { ApiError } from '@/lib/api/api-error';

const maxRetries = 3;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Above 0 so data prefetched on the server isn't refetched right
        // after hydration.
        staleTime: 60 * 1000,
        // 4xx errors won't fix themselves on retry.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.statusCode < 500) &&
          failureCount < maxRetries,
      },
      dehydrate: {
        // Also dehydrate pending queries so server components can prefetch
        // without awaiting and stream the result to the client.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
        // Next.js detects dynamic rendering through error digests, so errors
        // must not be redacted.
        shouldRedactErrors: () => false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * A new client per request on the server (never share cached data between
 * users) and a singleton in the browser (so React suspending during the
 * initial render doesn't throw the cache away).
 */
export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
