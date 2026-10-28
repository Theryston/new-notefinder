import type { Page, Request } from '@playwright/test';
import type { ProfileVisibility } from '@vozzify/contracts';

const VISIBILITY_ROUTE = '**/v1/me/profile-visibility';

export type VisibilityReply = {
  status?: number;
  body: unknown;
  delayMs?: number;
};

/**
 * Serves the owner's `profile-visibility` from the browser: `GET` answers the
 * stored flags, `PATCH` applies the flags it names and answers all of them,
 * as the API does. `reply` overrides a save (errors, slow answers). The list
 * returned records every save request, never the reads.
 */
export async function mockProfileVisibilityApi(
  page: Page,
  {
    flags,
    reply,
  }: {
    flags: ProfileVisibility;
    reply?: (request: Request) => VisibilityReply;
  },
): Promise<Request[]> {
  const saves: Request[] = [];
  let stored: ProfileVisibility = { ...flags };
  // The flags the request names change; the others keep their stored value.
  const saveLikeApi = (request: Request): ProfileVisibility => {
    const changes = JSON.parse(
      request.postData() ?? '{}',
    ) as Partial<ProfileVisibility>;
    stored = { ...stored, ...changes };
    return stored;
  };

  await page.route(VISIBILITY_ROUTE, async (route) => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers':
        request.headers()['access-control-request-headers'] ?? '',
      'access-control-allow-methods': 'GET, PATCH, OPTIONS',
      'content-type': 'application/json',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(stored),
      });
      return;
    }
    saves.push(request);
    const {
      status = 200,
      body,
      delayMs = 0,
    } = reply ? reply(request) : { body: saveLikeApi(request) };
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ status, headers, body: JSON.stringify(body) });
  });
  return saves;
}
