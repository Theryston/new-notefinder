import type { Locale } from '@notefinder/contracts';
import { infiniteQueryOptions } from '@tanstack/react-query';

import type { HomeFeedPage } from './feed-page';
import { homeQueryKeys } from './query-keys';

/**
 * Fetches one page of rows in the browser. The client module is loaded on
 * the first request, so the schema's Zod stays out of the first-load JS.
 */
export async function fetchHomeRowsPage({
  locale,
  cursor,
  signal,
}: {
  locale: Locale;
  cursor: string | undefined;
  signal: AbortSignal;
}): Promise<HomeFeedPage> {
  const { fetchHomePageInBrowser } = await import('./home-feed-client');
  return fetchHomePageInBrowser({ locale, cursor, signal });
}

/**
 * The home's rows as an infinite query. The server-rendered first page seeds
 * it, so only later pages hit the network. The feed never goes stale on the
 * client: its cursors name one version, and a refetch would replay them.
 */
export function homeRowsQueryOptions(
  locale: Locale,
  initialPage: HomeFeedPage,
) {
  return infiniteQueryOptions({
    queryKey: homeQueryKeys.rows(locale),
    queryFn: ({ pageParam, signal }) =>
      fetchHomeRowsPage({ locale, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: HomeFeedPage) =>
      lastPage.nextCursor ?? undefined,
    initialData: { pages: [initialPage], pageParams: [undefined] },
    staleTime: Number.POSITIVE_INFINITY,
  });
}
