import type { Page, Route } from '@playwright/test';

/**
 * The routes the heart calls: `PUT` and `DELETE /v1/me/favorites/:trackId`
 * and `GET /v1/me/tracks/:trackId`. Served by the page, since they are
 * session-dependent and the fake API has no sessions of its own. Any host: the
 * API URL the browser calls is inlined when the app is built.
 */
const FAVORITE_ROUTES = '**/v1/me/favorites/**';
const STATE_ROUTES = '**/v1/me/tracks/**';

type FavoritesApiOptions = {
  /** Track IDs that are favorites at the start. */
  favorites?: string[];
  /** The status a `PUT` answers instead of 204, to test a failing request. */
  failAddWith?: number;
};

export type FavoritesApi = {
  /** The methods of the favorite requests the page sent, in order. */
  writes: string[];
};

const trackIdOf = (route: Route): string =>
  decodeURIComponent(
    new URL(route.request().url()).pathname.split('/').pop() ?? '',
  );

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

/** Serves the favorite routes of a signed-in User over an in-memory set. */
export async function mockFavoritesApi(
  page: Page,
  { favorites = [], failAddWith }: FavoritesApiOptions = {},
): Promise<FavoritesApi> {
  const current = new Set(favorites);
  const api: FavoritesApi = { writes: [] };

  await page.route(FAVORITE_ROUTES, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return fulfill(route, 204, null);
    api.writes.push(method);
    if (method === 'PUT' && failAddWith !== undefined) {
      return fulfill(route, failAddWith, {
        statusCode: failAddWith,
        code: 'INTERNAL_ERROR',
        message: 'Fake failure',
      });
    }
    if (method === 'PUT') current.add(trackIdOf(route));
    else current.delete(trackIdOf(route));
    return fulfill(route, 204, null);
  });
  await page.route(STATE_ROUTES, async (route) => {
    if (route.request().method() === 'OPTIONS')
      return fulfill(route, 204, null);
    return fulfill(route, 200, { isFavorite: current.has(trackIdOf(route)) });
  });
  return api;
}
