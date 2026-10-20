import type { ApiErrorCode, FollowListPage } from '@notefinder/contracts';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { followErrorCode } from './follow-changes';
import type { FollowListRowAction } from './follow-list-actions';
import type { FollowListSide } from './follow-list-query';
import { removeFollowerRequest, setFollow } from './follow-query';
import { profileKeys } from './query-keys';

/** The row acted on: its User, and what the row's button does to them. */
type FollowListChange = {
  userId: string;
  action: FollowListRowAction;
};

const SIDES: readonly FollowListSide[] = ['followers', 'following', 'friends'];

type FollowListData = InfiniteData<FollowListPage> | undefined;

/**
 * A cached follow list with the User who was just removed from it or
 * unfollowed out of it taken out of every loaded page. The server's list is
 * read again once the request settles, so this only keeps the row from
 * lingering on screen meanwhile. `undefined` stays `undefined` (nothing is
 * cached, so there is nothing to change).
 */
export function withoutListUser(
  data: FollowListData,
  userId: string,
): FollowListData {
  if (data === undefined) return undefined;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== userId),
    })),
  };
}

/** The request of one row: a removed follower, or an unfollow. */
export function sendFollowListAction(
  username: string,
  { userId, action }: FollowListChange,
): Promise<undefined> {
  return action === 'removeFollower'
    ? removeFollowerRequest(username, userId)
    : setFollow(userId, false);
}

/**
 * Takes the row's User out of the open list at once, and returns what the list
 * held before, to put back if the request fails. A read in flight is cancelled
 * first, since it would land after the removal and bring the row back.
 */
export async function removeFromFollowList(
  queryClient: QueryClient,
  username: string,
  side: FollowListSide,
  userId: string,
): Promise<FollowListData> {
  const key = profileKeys.followList(username, side);
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<InfiniteData<FollowListPage>>(key);
  queryClient.setQueryData<InfiniteData<FollowListPage>>(key, (data) =>
    withoutListUser(data, userId),
  );
  return previous;
}

/** Puts the open list back as it was before the removal (a failed request). */
export function restoreFollowList(
  queryClient: QueryClient,
  username: string,
  side: FollowListSide,
  previous: FollowListData,
): void {
  queryClient.setQueryData(profileKeys.followList(username, side), previous);
}

/** The queries a row's request can change: the counts and the three lists. */
export function followListKeys(username: string) {
  return [
    profileKeys.counts(username),
    ...SIDES.map((list) => profileKeys.followList(username, list)),
  ];
}

/** Reads the counts and every list of the Profile again once the request settles. */
export async function settleFollowListAction(
  queryClient: QueryClient,
  username: string,
): Promise<void> {
  await Promise.all(
    followListKeys(username).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export type FollowListActionOptions = {
  queryClient: QueryClient;
  username: string;
  side: FollowListSide;
  /** Translates the API's error code into the message shown (`errors.<CODE>`). */
  translate: (code: ApiErrorCode) => string;
  /** Shows the message of a failed request, e.g. as a toast. */
  notify: (message: string) => void;
};

/**
 * The mutation of a list row: the request, the optimistic removal from the
 * open list, its rollback with a message when the request fails, and the
 * refresh once it settles. The hook only wires it to the query client and the
 * translations, so this logic can be unit tested.
 */
export function followListActionMutation({
  queryClient,
  username,
  side,
  translate,
  notify,
}: FollowListActionOptions) {
  return {
    mutationFn: (change: FollowListChange) =>
      sendFollowListAction(username, change),
    onMutate: async ({ userId }: FollowListChange) => ({
      previous: await removeFromFollowList(queryClient, username, side, userId),
    }),
    onError: (
      error: unknown,
      _change: FollowListChange,
      context: { previous: FollowListData } | undefined,
    ) => {
      restoreFollowList(queryClient, username, side, context?.previous);
      notify(translate(followErrorCode(error)));
    },
    onSettled: () => settleFollowListAction(queryClient, username),
  };
}
