import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchSessionUser,
  parseSessionUser,
  sessionUserOptions,
} from './session';

vi.mock('@/lib/env/client', () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_API_URL: 'https://api.test/' }),
}));

const apiUser = {
  id: 'usr_1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  username: 'ada',
  image: null,
};

describe('parseSessionUser', () => {
  it('keeps what the gate needs', () => {
    expect(parseSessionUser({ session: {}, user: apiUser })).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      emailVerified: true,
      username: 'ada',
    });
  });

  it('normalizes missing or odd fields', () => {
    expect(
      parseSessionUser({
        user: { email: 'ada@example.com', emailVerified: 'yes', username: '' },
      }),
    ).toEqual({
      name: '',
      email: 'ada@example.com',
      emailVerified: false,
      username: null,
    });
  });

  it('keeps the photo URL (Google sign-ups have one)', () => {
    const image = 'https://lh3.googleusercontent.com/a/photo=s96-c';
    expect(parseSessionUser({ user: { ...apiUser, image } })?.image).toBe(
      image,
    );
  });

  it.each([[null], [''], [42]])('has no photo for image %j', (image) => {
    const user = parseSessionUser({ user: { ...apiUser, image } });
    expect(user).not.toBeNull();
    expect(user?.image).toBeUndefined();
  });

  it.each([[null], [undefined], ['x'], [{}], [{ user: null }], [{ user: {} }]])(
    'is null when signed out or malformed: %j',
    (body) => {
      expect(parseSessionUser(body)).toBeNull();
    },
  );
});

describe('fetchSessionUser', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  it('asks get-session with the cookies', async () => {
    fetchMock.mockResolvedValue(Response.json({ session: {}, user: apiUser }));
    const signal = new AbortController().signal;

    await expect(fetchSessionUser(signal)).resolves.toMatchObject({
      username: 'ada',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/v1/auth/get-session',
      { credentials: 'include', signal },
    );
  });

  it('is null when signed out', async () => {
    fetchMock.mockResolvedValue(Response.json(null));
    await expect(fetchSessionUser()).resolves.toBeNull();
  });

  it('fails on an error answer', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }));
    await expect(fetchSessionUser()).rejects.toThrow('(503)');
  });

  it('backs a cached query', async () => {
    fetchMock.mockResolvedValue(Response.json(null));
    const queryClient = new QueryClient();

    await expect(
      queryClient.fetchQuery(sessionUserOptions()),
    ).resolves.toBeNull();
    expect(sessionUserOptions().queryKey).toEqual(['auth', 'session']);
    expect(sessionUserOptions().staleTime).toBe(300_000);
  });
});
