import type { QueryClient } from '@tanstack/react-query';
import type { ApiErrorCode, ProfileFollow } from '@vozzify/contracts';

import { isApiError } from '@/lib/api/api-error';

import { type FollowCounts, followersAfter } from './follow-state';
import { profileKeys } from './query-keys';

/** What the caches held before a follow change, to put back if it fails. */
export type FollowSnapshot = {
  follow: ProfileFollow | undefined;
  counts: FollowCounts | undefined;
};

/**
 * Writes a follow change into the caches before the request goes out, so the
 * button and the follower count change at once, and returns what to put back.
 */
export async function applyFollowChange(
  queryClient: QueryClient,
  username: string,
  follow: boolean,
): Promise<FollowSnapshot> {
  const followKey = profileKeys.follow(username);
  const countsKey = profileKeys.counts(username);
  // A read in flight would land after the write and undo it.
  await Promise.all([
    queryClient.cancelQueries({ queryKey: followKey }),
    queryClient.cancelQueries({ queryKey: countsKey }),
  ]);
  const snapshot: FollowSnapshot = {
    follow: queryClient.getQueryData<ProfileFollow>(followKey),
    counts: queryClient.getQueryData<FollowCounts>(countsKey),
  };
  const wasFollowing = snapshot.follow?.isFollowing ?? false;
  queryClient.setQueryData<ProfileFollow>(followKey, (current) =>
    current ? { ...current, isFollowing: follow } : current,
  );
  queryClient.setQueryData<FollowCounts>(countsKey, (current) =>
    current
      ? {
          ...current,
          followersCount: followersAfter(
            current.followersCount,
            wasFollowing,
            follow,
          ),
        }
      : current,
  );
  return snapshot;
}

/** Puts back the caches as they were before the change (a failed request). */
export function rollbackFollowChange(
  queryClient: QueryClient,
  username: string,
  snapshot: FollowSnapshot | undefined,
): void {
  if (!snapshot) return;
  queryClient.setQueryData(profileKeys.follow(username), snapshot.follow);
  queryClient.setQueryData(profileKeys.counts(username), snapshot.counts);
}

/** Reads both again once the request settles, whatever its outcome. */
export async function settleFollowChange(
  queryClient: QueryClient,
  username: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: profileKeys.follow(username) }),
    queryClient.invalidateQueries({ queryKey: profileKeys.counts(username) }),
  ]);
}

/** The error code a failed follow is translated from (`errors.<CODE>`). */
export function followErrorCode(error: unknown): ApiErrorCode {
  return isApiError(error) ? error.code : 'INTERNAL_ERROR';
}
