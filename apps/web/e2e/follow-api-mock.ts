import type { Page, Route } from '@playwright/test';

/**
 * The routes the follow button and the counts call: `GET .../follow` and the
 * `PUT`/`DELETE` of `/v1/me/following/:userId` (session-dependent, so the page
 * serves them), and the banner's own `GET /v1/users/:username`, which the
 * counts re-read after a change. Any host: the API URL the browser calls is
 * inlined when the app is built.
 */
const FOLLOW_STATE_ROUTE = (username: string) =>
  `**/v1/users/${username}/follow`;
const FOLLOW_WRITE_ROUTES = '**/v1/me/following/**';
const PROFILE_ROUTE = (username: string) => `**/v1/users/${username}`;

export type FollowApiOptions = {
  /** The Profile's User, whose follow state is served. */
  username: string;
  userId: string;
  /** The follower count at the start. */
  followers: number;
  /** Whether the viewer follows the User at the start. */
  following?: boolean;
};

export type FollowApi = {
  /** The methods of the follow writes the page sent, in order. */
  writes: string[];
};

async function fulfill(route: Route, status: number, body: unknown) {
  const request = route.request();
  await route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
      'content-type': 'application/json',
    },
    body: body === null ? '' : JSON.stringify(body),
  });
}

/**
 * Serves the follow routes of one Profile over an in-memory state: a follow
 * adds a follower, an unfollow removes one, and the banner's counts read the
 * same state, as the API would answer them.
 */
export async function mockFollowApi(
  page: Page,
  { username, userId, followers, following = false }: FollowApiOptions,
): Promise<FollowApi> {
  const state = { followers, following };
  const api: FollowApi = { writes: [] };

  await page.route(FOLLOW_STATE_ROUTE(username), async (route) => {
    if (route.request().method() === 'OPTIONS')
      return fulfill(route, 204, null);
    return fulfill(route, 200, { userId, isFollowing: state.following });
  });

  await page.route(FOLLOW_WRITE_ROUTES, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return fulfill(route, 204, null);
    api.writes.push(method);
    const follow = method === 'PUT';
    if (follow !== state.following) {
      state.followers += follow ? 1 : -1;
      state.following = follow;
    }
    return fulfill(route, 204, null);
  });

  await page.route(PROFILE_ROUTE(username), async (route) => {
    if (route.request().method() === 'OPTIONS')
      return fulfill(route, 204, null);
    // The banner's own fields come from the fake API; only the counts are
    // overridden with the state of this test.
    const response = await route.fetch();
    const profile = await response.json();
    return fulfill(route, response.status(), {
      ...profile,
      followersCount: state.followers,
    });
  });

  return api;
}
