'use client';

import {
  type TrackContributorsPage,
  trackContributorsPageSchema,
} from '@notefinder/contracts';
import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { browserApi } from '@/lib/api/browser';

import { trackKeys } from '../query-keys';

const CONTRIBUTORS_PAGE_LIMIT = 20;

type ContributorsPageParams = {
  trackId: string;
  query: string;
  signal?: AbortSignal;
};

/** One page of the Track's Contributors (`GET /v1/tracks/:id/contributors`). */
function fetchContributorsPage({
  trackId,
  query,
  signal,
  cursor,
}: ContributorsPageParams & {
  cursor: string | undefined;
}): Promise<TrackContributorsPage> {
  return browserApi(`/tracks/${trackId}/contributors`, {
    schema: trackContributorsPageSchema,
    query: {
      limit: CONTRIBUTORS_PAGE_LIMIT,
      ...(cursor === undefined ? {} : { cursor }),
      ...(query === '' ? {} : { q: query }),
    },
    signal,
  });
}

/**
 * Infinite Contributors keyed by Track plus search text (the cursor travels
 * as the page param). While a new query loads, the previous pages stay on
 * screen, so typing never blanks the list.
 */
function contributorsInfiniteQueryOptions({
  trackId,
  query,
}: {
  trackId: string;
  query: string;
}) {
  return infiniteQueryOptions({
    placeholderData: keepPreviousData,
    queryKey: trackKeys.contributors(
      trackId,
      query === '' ? undefined : { q: query },
    ),
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | undefined;
      signal: AbortSignal;
    }) => fetchContributorsPage({ trackId, query, signal, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: TrackContributorsPage) =>
      lastPage.nextCursor ?? undefined,
    staleTime: 60 * 1000,
  });
}

/** Infinite Contributors of a Track, with search text. */
export function useContributors(trackId: string, query: string) {
  return useInfiniteQuery(contributorsInfiniteQueryOptions({ trackId, query }));
}
