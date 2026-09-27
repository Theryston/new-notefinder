import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import { getCurrentUser } from './session';

// `server-only` throws outside the react-server condition, which Vitest
// doesn't use.
vi.mock('server-only', () => ({}));

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock('next/headers', () => ({
  headers: async () => requestHeaders.current,
}));

const fetchMock = vi.fn<typeof fetch>();

const user = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@example.com',
  emailVerified: true,
  username: 'ana',
  image: null,
  role: 'USER',
  createdAt: '2024-05-01T12:00:00.000Z',
};

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api.test');
  vi.stubEnv('REVALIDATE_SECRET', 'test-revalidate-secret-at-least-32-chars');
  vi.stubGlobal('fetch', fetchMock);
  requestHeaders.current = new Headers({
    cookie: 'notefinder.session_token=abc',
  });
});

function lastRequest() {
  const [input, init = {}] = fetchMock.mock.lastCall ?? [];
  return { url: String(input), headers: new Headers(init.headers) };
}

describe('getCurrentUser', () => {
  it('returns the user from GET /v1/me, forwarding the cookies', async () => {
    fetchMock.mockResolvedValue(Response.json({ ...user, extra: 'dropped' }));

    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(lastRequest().url).toBe('http://api.test/v1/me');
    expect(lastRequest().headers.get('cookie')).toBe(
      'notefinder.session_token=abc',
    );
  });

  it('returns null when signed out (401)', async () => {
    requestHeaders.current = new Headers();
    fetchMock.mockResolvedValue(
      Response.json(
        {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        { status: 401 },
      ),
    );

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(lastRequest().headers.has('cookie')).toBe(false);
  });

  it('throws other API errors', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
        { status: 500 },
      ),
    );

    await expect(getCurrentUser()).rejects.toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  });

  it('throws when the response does not match the contract', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'u1' }));

    await expect(getCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });
});
