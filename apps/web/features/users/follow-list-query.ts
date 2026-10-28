import { infiniteQueryOptions } from '@tanstack/react-query';
import { type FollowListPage, followListPageSchema } from '@vozzify/contracts';

import { browserApi } from '@/lib/api/browser';

import { profileKeys } from './query-keys';

/** Which list of a Profile's follows is shown. */
export type FollowListSide = 'followers' | 'following' | 'friends';

/** Users per page, the API's default page size. */
export const FOLLOW_LIST_PAGE_LIMIT = 20;

/** The API path of one follow list of a Profile (`/users/:username/...`). */
export function followListPath(username: string, side: FollowListSide) {
  return `/users/${encodeURIComponent(username)}/${side}` as const;
}

/** The cursor of the next page, or `undefined` once the list is read. */
export function nextFollowListPageParam(
  lastPage: FollowListPage,
): string | undefined {
  return lastPage.nextCursor ?? undefined;
}

type FollowListPageParams = {
  username: string;
  side: FollowListSide;
  cursor: string | undefined;
  signal: AbortSignal;
};

/** One page of a follow list, read in the browser (the lists are public). */
function fetchFollowListPage({
  username,
  side,
  cursor,
  signal,
}: FollowListPageParams): Promise<FollowListPage> {
  return browserApi(followListPath(username, side), {
    schema: followListPageSchema,
    query: {
      limit: FOLLOW_LIST_PAGE_LIMIT,
      ...(cursor === undefined ? {} : { cursor }),
    },
    signal,
  });
}

/**
 * An infinite follow list keyed by Profile and side (the cursor travels as the
 * page param). Kept for a minute, so reopening the list shows it at once.
 */
export function followListInfiniteQueryOptions(
  username: string,
  side: FollowListSide,
) {
  return infiniteQueryOptions({
    queryKey: profileKeys.followList(username, side),
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | undefined;
      signal: AbortSignal;
    }) => fetchFollowListPage({ username, side, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextFollowListPageParam,
    staleTime: 60 * 1000,
  });
}
