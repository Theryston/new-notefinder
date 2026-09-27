import { revalidateTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

// `server-only` throws outside the react-server condition, which Vitest
// doesn't use.
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

const secret = 'test-revalidate-secret-at-least-32-chars';

beforeEach(() => {
  // Read lazily (and cached) on the first request.
  vi.stubEnv('API_URL', 'http://api.test');
  vi.stubEnv('REVALIDATE_SECRET', secret);
});

function request(body: unknown, authorization?: string) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (authorization) headers.set('authorization', authorization);
  return new Request('http://web.test/api/revalidate', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validBody = { tags: ['track:abc', 'home'] };

describe('POST /api/revalidate', () => {
  it.each([
    ['no authorization header', undefined],
    ['a wrong secret', `Bearer ${secret}x`],
    ['a secret prefix', `Bearer ${secret.slice(0, 10)}`],
    ['the wrong scheme', `Basic ${secret}`],
    ['an empty bearer token', 'Bearer '],
  ])('returns 401 with %s', async (_, authorization) => {
    const response = await POST(request(validBody, authorization));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('returns 400 BAD_REQUEST for a body that is not JSON', async () => {
    const response = await POST(request('{nope', `Bearer ${secret}`));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([
    ['missing tags', {}],
    ['empty tags', { tags: [] }],
    ['an empty tag', { tags: [''] }],
    ['a tag over 256 chars', { tags: ['x'.repeat(257)] }],
    [
      'more than 50 tags',
      { tags: Array.from({ length: 51 }, (_, i) => `t${i}`) },
    ],
  ])('returns 400 VALIDATION_FAILED for %s', async (_, body) => {
    const response = await POST(request(body, `Bearer ${secret}`));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      details: expect.any(Object),
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('revalidates every tag with the max profile', async () => {
    const response = await POST(request(validBody, `Bearer ${secret}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      revalidated: validBody.tags,
    });
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(revalidateTag).toHaveBeenCalledWith('track:abc', 'max');
    expect(revalidateTag).toHaveBeenCalledWith('home', 'max');
  });
});
