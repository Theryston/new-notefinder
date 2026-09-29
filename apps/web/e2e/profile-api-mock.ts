import type { Page, Request } from '@playwright/test';

import type { MockUser } from './auth-api-mock';

// Any host: like the auth routes, the API URL is inlined at build time.
const ME_ROUTE = '**/v1/me';

export type MeReply = { status?: number; body: unknown; delayMs?: number };

/** The `PATCH /v1/me` body the real API answers with. */
export function currentUserBody(user: MockUser, name = user.name) {
  const { id, email, emailVerified, username, image, createdAt } = user;
  return {
    id,
    name,
    email,
    emailVerified,
    username,
    image,
    role: 'USER',
    createdAt,
  };
}

/** The text fields of a multipart request, by name. */
export function multipartFields(request: Request): Record<string, string> {
  const body = request.postData() ?? '';
  const fields: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(
    /name="([^"]+)"\r\n\r\n([^\r]*)\r\n/g,
  )) {
    if (name !== undefined && value !== undefined) fields[name] = value;
  }
  return fields;
}

/**
 * Serves `PATCH /v1/me`. By default it saves the trimmed Name, like the API;
 * `reply` overrides the answer (errors, slow responses). The returned list
 * records every save request.
 */
export async function mockProfileApi(
  page: Page,
  {
    user,
    reply = (request) => ({
      body: currentUserBody(user, (multipartFields(request).name ?? '').trim()),
    }),
  }: { user: MockUser; reply?: (request: Request) => MeReply },
): Promise<Request[]> {
  const saves: Request[] = [];

  await page.route(ME_ROUTE, async (route) => {
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
    saves.push(request);
    const { status = 200, body, delayMs = 0 } = reply(request);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ status, headers, body: JSON.stringify(body) });
  });
  return saves;
}
