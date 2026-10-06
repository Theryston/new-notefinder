'use client';

import {
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_OFFSET,
  type SearchResult,
  type SearchScope,
  searchResultSchema,
} from '@notefinder/contracts';
import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { browserApi } from '@/lib/api/browser';

import { searchKeys } from '../query-keys';
import { isSearchableQuery, normalizeSearchQuery } from '../search-params';

export type SearchPageParams = {
  query: string;
  scope: SearchScope;
  limit: number;
  offset: number;
  signal?: AbortSignal;
};

/**
 * One page of the public search (`GET /v1/search`), in catalog rank order.
 * The signal aborts superseded fetches, so stale results never overwrite
 * fresh ones while the user keeps typing.
 */
export function fetchSearchPage({
  query,
  scope,
  limit,
  offset,
  signal,
}: SearchPageParams): Promise<SearchResult> {
  return browserApi('/search', {
    schema: searchResultSchema,
    query: { query, scope, limit, offset },
    signal,
  });
}

export type SearchInfiniteInput = {
  query: string;
  scope: SearchScope;
  limit?: number;
};

/**
 * Infinite results keyed by query text plus scope (the offset travels as
 * the page param). Disabled while blank, so the API only sees queries worth
 * answering.
 */
export function searchInfiniteQueryOptions({
  query,
  scope,
  limit = SEARCH_DEFAULT_LIMIT,
}: SearchInfiniteInput) {
  const enabled = isSearchableQuery(query);
  return infiniteQueryOptions({
    // While a new query loads, the previous page stays on screen (the grid
    // dims it), so typing never flashes a skeleton over known results.
    placeholderData: keepPreviousData,
    // A disabled query never fetches, but it still needs a stable key: the
    // normalized blank, so every blank spells the same key.
    queryKey: enabled
      ? searchKeys.infiniteResults({ query, scope, limit })
      : ([
          ...searchKeys.all,
          'infinite',
          { query: normalizeSearchQuery(query), scope, limit },
        ] as const),
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: number;
      signal: AbortSignal;
    }) => fetchSearchPage({ query, scope, limit, offset: pageParam, signal }),
    initialPageParam: 0,
    getNextPageParam: (
      lastPage: SearchResult,
      _allPages: SearchResult[],
      lastPageParam: number,
    ) => {
      if (lastPage.results.length < limit) return undefined;
      const nextOffset = lastPageParam + lastPage.results.length;
      return nextOffset > SEARCH_MAX_OFFSET ? undefined : nextOffset;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

/** Realtime results for the search page (infinite scroll over limit/offset). */
export function useSearchResults(input: SearchInfiniteInput) {
  return useInfiniteQuery(searchInfiniteQueryOptions(input));
}
