import type { Page, Route } from '@playwright/test';

import type { FollowListUserFixture } from './follow-lists-api-mock';

/**
 * The fake API for a Profile whose owner acts on its follow lists. Unlike the
 * read-only list mock, it keeps the lists in memory: a removal or an unfollow
 * takes the User out of the lists it leaves, and the Profile's counts (read
 * again after the action) come from the same state, as the API would answer.
 */

type ListSide = 'followers' | 'following' | 'friends';
type Lists = Record<ListSide, FollowListUserFixture[]>;

export type FollowListActionsOptions = {
  /** The Profile's username (the owner's). */
  username: string;
  /** The Profile's User ID, as the follow state reports it. */
  userId: string;
  /** The lists at the start. A friend is in both `followers` and `following`. */
  lists: Lists;
  /** Whether the viewer already follows the Profile's User (visitors only). */
  viewerFollows?: boolean;
  /** Answer every write with `403 FORBIDDEN`, as the API does for a non-owner. */
  forbidWrites?: boolean;
};

export type FollowListActionsApi = {
  /** The writes the page sent, as `remove-follower:<id>` or `unfollow:<id>`. */
  writes: string[];
  /** The User IDs currently in each list, as the fake API holds them. */
  current: () => Record<ListSide, string[]>;
};

const HEADERS = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
  'content-type': 'application/json',
};

async function fulfill(route: Route, status: number, body: unknown) {
  const origin = route.request().headers().origin ?? '*';
  await route.fulfill({
    status,
    headers: { ...HEADERS, 'access-control-allow-origin': origin },
    body: body === null ? '' : JSON.stringify(body),
  });
}

const forbidden = (route: Route) =>
  fulfill(route, 403, {
    statusCode: 403,
    code: 'FORBIDDEN',
    message: 'Only the User of a Profile can remove its followers',
  });

const without = (users: FollowListUserFixture[], id: string) =>
  users.filter((user) => user.id !== id);

/** The lists in memory, and the writes that change them. */
function createLists(initial: Lists, writes: string[]) {
  const state: Lists = {
    followers: [...initial.followers],
    following: [...initial.following],
    friends: [...initial.friends],
  };
  return {
    state,
    removeFollower(id: string) {
      writes.push(`remove-follower:${id}`);
      state.followers = without(state.followers, id);
      state.friends = without(state.friends, id);
    },
    unfollow(id: string) {
      writes.push(`unfollow:${id}`);
      state.following = without(state.following, id);
      state.friends = without(state.friends, id);
    },
  };
}

/** `GET` of the lists and the follow state, and `DELETE` of a follower. */
async function routeProfileLists(
  page: Page,
  profilePath: string,
  options: FollowListActionsOptions,
  lists: ReturnType<typeof createLists>,
): Promise<void> {
  await page.route(`**${profilePath}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return fulfill(route, 204, null);
    const rest = new URL(request.url()).pathname.slice(profilePath.length + 1);
    if (rest === 'follow') {
      return fulfill(route, 200, {
        userId: options.userId,
        isFollowing: options.viewerFollows ?? false,
      });
    }
    const [side, followerId] = rest.split('/');
    if (side !== 'followers' && side !== 'following' && side !== 'friends') {
      return route.fallback();
    }
    if (request.method() === 'DELETE' && followerId !== undefined) {
      if (options.forbidWrites) return forbidden(route);
      lists.removeFollower(decodeURIComponent(followerId));
      return fulfill(route, 204, null);
    }
    return fulfill(route, 200, { items: lists.state[side], nextCursor: null });
  });
}

/** The Profile banner, with its counts read from the same lists. */
async function routeProfileCounts(
  page: Page,
  profilePath: string,
  lists: ReturnType<typeof createLists>,
): Promise<void> {
  await page.route(`**${profilePath}`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return fulfill(route, 204, null);
    }
    // The banner's other fields come from the fake API.
    const response = await route.fetch();
    const profile = await response.json();
    return fulfill(route, response.status(), {
      ...profile,
      followersCount: lists.state.followers.length,
      followingCount: lists.state.following.length,
      friendsCount: lists.state.friends.length,
    });
  });
}

/** `DELETE /v1/me/following/:userId`: the owner's unfollow. */
async function routeOwnUnfollow(
  page: Page,
  options: FollowListActionsOptions,
  lists: ReturnType<typeof createLists>,
): Promise<void> {
  await page.route('**/v1/me/following/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return fulfill(route, 204, null);
    }
    if (options.forbidWrites) return forbidden(route);
    const path = new URL(route.request().url()).pathname;
    lists.unfollow(decodeURIComponent(path.split('/').pop() ?? ''));
    return fulfill(route, 204, null);
  });
}

/** Serves the follow lists, counts and writes of one Profile from memory. */
export async function mockFollowListActions(
  page: Page,
  options: FollowListActionsOptions,
): Promise<FollowListActionsApi> {
  const writes: string[] = [];
  const lists = createLists(options.lists, writes);
  const profilePath = `/v1/users/${options.username}`;
  await routeProfileLists(page, profilePath, options, lists);
  await routeProfileCounts(page, profilePath, lists);
  await routeOwnUnfollow(page, options, lists);
  return {
    writes,
    current: () => ({
      followers: lists.state.followers.map((user) => user.id),
      following: lists.state.following.map((user) => user.id),
      friends: lists.state.friends.map((user) => user.id),
    }),
  };
}
