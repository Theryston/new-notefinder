import { expect, type Page, test } from '@playwright/test';

const userId = 'usr_existing';
const recordedKey = `vozzify:acquisition-recorded:${userId}`;

async function mockApi(page: Page, responses: number[]) {
  const requests: unknown[] = [];

  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const origin = request.headers().origin ?? '*';
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    };

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }

    const path = url.pathname.replace(/^\/v1/, '');
    let status = 200;
    let body: unknown = {};
    if (path === '/auth/get-session') {
      body = {
        session: { id: 'ses_existing' },
        user: {
          id: userId,
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          emailVerified: true,
          username: 'ada',
          image: null,
        },
      };
    } else if (path === '/me/acquisition') {
      requests.push(request.postDataJSON());
      status = responses[requests.length - 1] ?? 201;
      body =
        status === 201
          ? { recorded: true }
          : {
              statusCode: status,
              code: status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR',
              message: 'Mock acquisition failure',
            };
    }

    await route.fulfill({
      status,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  return requests;
}

test('a duplicate conflict is remembered for this user across locale loads', async ({
  page,
}) => {
  const requests = await mockApi(page, [409]);

  await page.goto('/en/terms');
  await expect.poll(() => requests.length).toBe(1);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), recordedKey))
    .toBe('true');

  await page.goto('/pt-BR/terms');
  await page.waitForLoadState('networkidle');
  expect(requests).toHaveLength(1);
});

test('a transient API failure can retry on the next document load', async ({
  page,
}) => {
  const requests = await mockApi(page, [500, 201]);

  await page.goto('/en/terms');
  await expect.poll(() => requests.length).toBe(1);
  await page.waitForLoadState('networkidle');
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), recordedKey))
    .toBeNull();

  await page.goto('/pt-BR/terms');
  await expect.poll(() => requests.length).toBe(2);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), recordedKey))
    .toBe('true');
});
