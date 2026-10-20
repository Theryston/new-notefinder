import type { Page, Route } from '@playwright/test';

/**
 * The three follow lists of a Profile (`GET /v1/users/:username/{followers,
 * following,friends}`), served from fixed lists. Pages hold 20 Users, as the
 * API does by default; the cursor is the offset of the next page, which is
 * opaque to the client, so any string works.
 */
const FOLLOW_LIST_LIMIT = 20;

type FollowListSideName = 'followers' | 'following' | 'friends';

export type FollowListUserFixture = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
};

export type FollowListsOptions = {
  username: string;
  lists: Record<FollowListSideName, FollowListUserFixture[]>;
};

async function fulfill(route: Route, status: number, body: unknown) {
  const request = route.request();
  await route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, OPTIONS',
      'content-type': 'application/json',
    },
    body: body === null ? '' : JSON.stringify(body),
  });
}

/** The page of one list that the request's cursor (an offset) asks for. */
function pageOf(
  items: FollowListUserFixture[],
  cursor: string | null,
): { items: FollowListUserFixture[]; nextCursor: string | null } {
  const offset = cursor === null ? 0 : Number(cursor);
  const end = offset + FOLLOW_LIST_LIMIT;
  return {
    items: items.slice(offset, end),
    nextCursor: end < items.length ? String(end) : null,
  };
}

/** Serves the three follow lists of one Profile, page by page. */
export async function mockFollowLists(
  page: Page,
  { username, lists }: FollowListsOptions,
): Promise<void> {
  for (const side of ['followers', 'following', 'friends'] as const) {
    await page.route(`**/v1/users/${username}/${side}**`, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return fulfill(route, 204, null);
      }
      const cursor = new URL(route.request().url()).searchParams.get('cursor');
      return fulfill(route, 200, pageOf(lists[side], cursor));
    });
  }
}
