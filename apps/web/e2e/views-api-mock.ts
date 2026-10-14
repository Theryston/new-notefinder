import type { Page, Route } from '@playwright/test';

/**
 * `POST /v1/tracks/:trackId/views`, served by the page: the browser calls it
 * cross-origin with cookies, and the specs need to see what it sent. Any
 * host: the API URL the browser calls is inlined when the app is built.
 */
const VIEW_ROUTES = '**/v1/tracks/*/views';

export type ViewsApi = {
  /** The bodies of the view requests the page sent, in order. */
  posts: { trackId: string; body: { viewId?: string } }[];
};

async function fulfill(route: Route, status: number, body: unknown) {
  const request = route.request();
  await route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      'content-type': 'application/json',
    },
    body: body === null ? '' : JSON.stringify(body),
  });
}

/**
 * Serves the view route like the API: a post without an ID records a view
 * (201, a new ID), a post with one answers it (200).
 */
export async function mockViewsApi(page: Page): Promise<ViewsApi> {
  const api: ViewsApi = { posts: [] };

  await page.route(VIEW_ROUTES, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return fulfill(route, 204, null);
    const segments = new URL(request.url()).pathname.split('/');
    const trackId = decodeURIComponent(segments.at(-2) ?? '');
    const body: { viewId?: string } = request.postDataJSON() ?? {};
    api.posts.push({ trackId, body });
    if (body.viewId !== undefined) {
      return fulfill(route, 200, { viewId: body.viewId });
    }
    return fulfill(route, 201, { viewId: `view-${api.posts.length}` });
  });
  return api;
}
