import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionUserOptions } from './session';

const getSession = vi.fn();

vi.mock('@/lib/auth/client', () => ({
  getAuthClient: () => ({ getSession }),
}));

describe('sessionUserOptions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('returns the signed-in user', async () => {
    const user = { id: 'usr_1', name: 'Ada', username: null };
    getSession.mockResolvedValue({ data: { user }, error: null });

    await expect(queryClient.fetchQuery(sessionUserOptions())).resolves.toBe(
      user,
    );
  });

  it('returns null when signed out', async () => {
    getSession.mockResolvedValue({ data: null, error: null });

    await expect(
      queryClient.fetchQuery(sessionUserOptions()),
    ).resolves.toBeNull();
  });

  it('fails when the lookup fails', async () => {
    getSession.mockResolvedValue({
      data: null,
      error: { message: 'Unavailable', status: 503 },
    });

    await expect(queryClient.fetchQuery(sessionUserOptions())).rejects.toThrow(
      'Unavailable',
    );
  });

  it('has a stable key', () => {
    expect(sessionUserOptions().queryKey).toEqual(['auth', 'session']);
  });
});
