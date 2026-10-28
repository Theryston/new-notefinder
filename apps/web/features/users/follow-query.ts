import { queryOptions } from '@tanstack/react-query';
import {
  type ProfileFollow,
  profileFollowSchema,
  publicProfileSchema,
} from '@vozzify/contracts';
import { z } from 'zod';

import { browserApi } from '@/lib/api/browser';

import { type FollowCounts, followCountsOf } from './follow-state';
import { profileKeys } from './query-keys';

const profilePath = (username: string) =>
  `/users/${encodeURIComponent(username)}` as const;

/** The viewer's follow state with the Profile's User (`GET .../follow`). */
export function fetchProfileFollow(username: string): Promise<ProfileFollow> {
  return browserApi(`${profilePath(username)}/follow`, {
    schema: profileFollowSchema,
  });
}

/** The follow counts of a Profile, read from the API (not the banner cache). */
export async function fetchProfileCounts(
  username: string,
): Promise<FollowCounts> {
  const profile = await browserApi(profilePath(username), {
    schema: publicProfileSchema,
  });
  return followCountsOf(profile);
}

/**
 * What the signed-in viewer has with the Profile's User. Read in the browser
 * only for a signed-in visitor who is not the owner: the public banner is
 * cached and has none of it.
 */
export function profileFollowQueryOptions(username: string) {
  return queryOptions({
    queryKey: profileKeys.follow(username),
    queryFn: () => fetchProfileFollow(username),
  });
}

/**
 * The follow counts under the banner. Seeded with the counts the server
 * rendered, and never stale on its own: it is read again only after a follow
 * change, straight from the API (the web cache of the banner lags behind it).
 * Dropped when nothing shows it, so a later visit starts from the server's
 * counts again.
 */
export function profileCountsQueryOptions(
  username: string,
  initial: FollowCounts,
) {
  return queryOptions({
    queryKey: profileKeys.counts(username),
    queryFn: () => fetchProfileCounts(username),
    initialData: initial,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });
}

/** Removes one of the signed-in User's followers (`DELETE /me/followers/:id`). */
export function removeFollowerRequest(followerId: string): Promise<undefined> {
  return browserApi(`/me/followers/${encodeURIComponent(followerId)}`, {
    method: 'DELETE',
    schema: z.undefined(),
  });
}

/** Follows a User by ID, or stops following them (both idempotent). */
export function setFollow(userId: string, follow: boolean): Promise<undefined> {
  return browserApi(`/me/following/${encodeURIComponent(userId)}`, {
    method: follow ? 'PUT' : 'DELETE',
    schema: z.undefined(),
  });
}
