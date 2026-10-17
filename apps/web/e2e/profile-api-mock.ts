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
    dailyPracticeTargetSeconds: user.dailyPracticeTargetSeconds ?? null,
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

type MultipartFile = {
  filename: string;
  contentType: string;
  bytes: Buffer;
};

/** The file part `field` of a multipart request, if it has one. */
export function multipartFile(
  request: Request,
  field: string,
): MultipartFile | undefined {
  const boundary = /boundary=(.+)$/.exec(
    request.headers()['content-type'] ?? '',
  )?.[1];
  const body = request.postDataBuffer();
  if (!boundary || !body) return undefined;
  // latin1 maps every byte to one character, so the file's bytes come back
  // unchanged from the slice of the text.
  const part = new RegExp(
    `name="${field}"; filename="([^"]*)"\\r\\nContent-Type: ([^\\r]*)\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--${boundary}`,
  ).exec(body.toString('latin1'));
  if (!part) return undefined;
  const [, filename = '', contentType = '', content = ''] = part;
  return { filename, contentType, bytes: Buffer.from(content, 'latin1') };
}

/** The profile a save writes, like the API stores it. */
export type StoredProfile = {
  name: string;
  image: string | null;
  dailyPracticeTargetSeconds: number | null;
};

/**
 * Applies a multipart save to the stored profile, like the API: the trimmed
 * Name, and the Daily target when its part was sent. Shared by the default
 * save below and replies that track more (e.g. uploads).
 */
export const applyProfileSave = (
  stored: StoredProfile,
  request: Request,
): StoredProfile => {
  const fields = multipartFields(request);
  return {
    ...stored,
    name: (fields.name ?? '').trim(),
    ...(fields.dailyPracticeTargetSeconds === undefined
      ? {}
      : {
          dailyPracticeTargetSeconds: Number(fields.dailyPracticeTargetSeconds),
        }),
  };
};

/**
 * Serves `/v1/me`: `GET` answers the stored profile (like the database, so
 * the form pre-fills what a previous save wrote), `PATCH` saves. By default
 * a save keeps the trimmed Name and, when sent, the Daily target, like the
 * API; `reply` overrides the save answer (errors, slow responses). The
 * returned list records every save request, never the prefill reads.
 */
export async function mockProfileApi(
  page: Page,
  { user, reply }: { user: MockUser; reply?: (request: Request) => MeReply },
): Promise<Request[]> {
  const saves: Request[] = [];
  let stored: StoredProfile = {
    name: user.name,
    image: user.image,
    dailyPracticeTargetSeconds: user.dailyPracticeTargetSeconds ?? null,
  };
  const saveLikeApi = (request: Request): MeReply => {
    stored = applyProfileSave(stored, request);
    return { body: currentUserBody({ ...user, ...stored }) };
  };

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
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(currentUserBody({ ...user, ...stored })),
      });
      return;
    }
    saves.push(request);
    const { status = 200, body, delayMs = 0 } = (reply ?? saveLikeApi)(request);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ status, headers, body: JSON.stringify(body) });
  });
  return saves;
}
