import { expect, test } from '@playwright/test';

import { webServerEnv } from './web-server-env';

const endpoint = '/api/revalidate';
const authorization = `Bearer ${webServerEnv.REVALIDATE_SECRET}`;

test.describe('POST /api/revalidate', () => {
  test('returns 401 without a secret', async ({ request }) => {
    const response = await request.post(endpoint, {
      data: { tags: ['home'] },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('returns 401 with a wrong secret', async ({ request }) => {
    const response = await request.post(endpoint, {
      headers: { authorization: `${authorization}-wrong` },
      data: { tags: ['home'] },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('returns 400 for an invalid body', async ({ request }) => {
    const response = await request.post(endpoint, {
      headers: { authorization },
      data: { tags: [] },
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  test('returns 400 for a body that is not JSON', async ({ request }) => {
    const response = await request.post(endpoint, {
      headers: { authorization, 'content-type': 'application/json' },
      // A string would be JSON-encoded; a Buffer is sent as-is.
      data: Buffer.from('{nope'),
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('revalidates valid tags', async ({ request }) => {
    const response = await request.post(endpoint, {
      headers: { authorization },
      data: { tags: ['home', 'track:clx123abc'] },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      revalidated: ['home', 'track:clx123abc'],
    });
  });
});
