import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClientEnv } from '@/lib/env/client';

import { authErrorCode } from './auth-error';
import { setUsername } from './set-username';

vi.mock('@/lib/env/client', () => ({ getClientEnv: vi.fn() }));

const fetchMock = vi.fn<typeof fetch>();

const currentUser = {
  id: 'usr_1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  username: 'ada',
  image: null,
  role: 'USER',
  createdAt: '2026-09-28T12:00:00.000Z',
};

const apiError = (statusCode: number, code: string) =>
  Response.json({ statusCode, code, message: 'nope' }, { status: statusCode });

beforeEach(() => {
  vi.mocked(getClientEnv).mockReturnValue({
    NEXT_PUBLIC_API_URL: 'https://api.test/',
  });
  vi.stubGlobal('fetch', fetchMock);
});

describe('setUsername', () => {
  it('puts the username to /v1/me/username with the cookies', async () => {
    fetchMock.mockResolvedValue(Response.json(currentUser));

    await expect(setUsername({ username: 'ada' })).resolves.toEqual({
      error: null,
    });

    const [input, init] = fetchMock.mock.lastCall ?? [];
    expect(String(input)).toBe('https://api.test/v1/me/username');
    expect(init?.method).toBe('PUT');
    expect(init?.credentials).toBe('include');
    expect(init?.body).toBe(JSON.stringify({ username: 'ada' }));
  });

  it.each([
    [409, 'CONFLICT', 'USERNAME_IS_ALREADY_TAKEN'],
    [400, 'VALIDATION_FAILED', 'INVALID_USERNAME'],
    [429, 'RATE_LIMITED', 'RATE_LIMITED'],
    [401, 'UNAUTHORIZED', 'UNAUTHORIZED'],
    [500, 'INTERNAL_ERROR', 'UNKNOWN'],
  ])('maps %i %s to the %s message', async (status, code, expected) => {
    fetchMock.mockResolvedValue(apiError(status, code));

    const { error } = await setUsername({ username: 'ada' });

    expect(error).not.toBeNull();
    expect(error && authErrorCode(error)).toBe(expected);
  });

  it('reports a network failure as an unknown error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const { error } = await setUsername({ username: 'ada' });

    expect(error && authErrorCode(error)).toBe('UNKNOWN');
  });

  it('reports an answer that breaks the contract as an unknown error', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));

    const { error } = await setUsername({ username: 'ada' });

    expect(error && authErrorCode(error)).toBe('UNKNOWN');
  });

  it('lets a failure that is not an API error through', async () => {
    vi.mocked(getClientEnv).mockImplementation(() => {
      throw new Error('Invalid public environment variables');
    });

    await expect(setUsername({ username: 'ada' })).rejects.toThrow(
      'Invalid public environment variables',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
