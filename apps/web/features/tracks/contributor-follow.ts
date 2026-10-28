import type { InfiniteData } from '@tanstack/react-query';
import type {
  TrackContributorEntry,
  TrackContributorsPage,
} from '@vozzify/contracts';
import { z } from 'zod';

import { browserApi } from '@/lib/api/browser';

/** The signed-in viewer, as far as a Contributor's follow button needs them. */
export type FollowViewer = { username: string | null };

/** What a Contributor's row can do: follow or unfollow the User, and its state. */
export type ContributorFollow = { userId: string; following: boolean };

/**
 * The follow button of a Contributor's row, or `null` for no button: an
 * anonymous viewer (the API sends no flag), a viewer without a Username, the
 * viewer's own row, and a Contributor without a Username. Usernames are unique,
 * so the own row is the one with the viewer's Username.
 */
export function contributorFollowOf(
  contributor: TrackContributorEntry,
  viewer: FollowViewer | null,
): ContributorFollow | null {
  if (viewer === null || viewer.username === null) return null;
  if (contributor.isFollowing === undefined) return null;
  if (contributor.userId === undefined) return null;
  if (contributor.username === null) return null;
  if (contributor.username === viewer.username) return null;
  return { userId: contributor.userId, following: contributor.isFollowing };
}

/**
 * Every cached page with the follow flag of one User set, so the row shows the
 * new state at once in whichever search the dialog is on. The other rows and
 * the paging are left as they were.
 */
export function withContributorFollow(
  data: InfiniteData<TrackContributorsPage> | undefined,
  userId: string,
  following: boolean,
): InfiniteData<TrackContributorsPage> | undefined {
  if (data === undefined) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.userId === userId ? { ...item, isFollowing: following } : item,
      ),
    })),
  };
}

/** Follows a User by ID, or stops following them (both idempotent). */
export function setContributorFollow(
  userId: string,
  follow: boolean,
): Promise<undefined> {
  return browserApi(`/me/following/${encodeURIComponent(userId)}`, {
    method: follow ? 'PUT' : 'DELETE',
    schema: z.undefined(),
  });
}
