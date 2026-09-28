import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usernameAvailabilityOptions } from './username-availability';

const isUsernameAvailable = vi.fn();

vi.mock('@/lib/auth/client', () => ({
  getAuthClient: () => ({ isUsernameAvailable }),
}));

describe('usernameAvailabilityOptions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('asks the API with the lowercased username', async () => {
    isUsernameAvailable.mockResolvedValue({
      data: { available: true },
      error: null,
    });

    await expect(
      queryClient.fetchQuery(usernameAvailabilityOptions(' Ada_Lovelace ')),
    ).resolves.toBe(true);
    expect(isUsernameAvailable).toHaveBeenCalledWith(
      { username: 'ada_lovelace' },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('reports a taken username', async () => {
    isUsernameAvailable.mockResolvedValue({
      data: { available: false },
      error: null,
    });

    await expect(
      queryClient.fetchQuery(usernameAvailabilityOptions('taken')),
    ).resolves.toBe(false);
  });

  it('fails when the API answers with an error', async () => {
    isUsernameAvailable.mockResolvedValue({
      data: null,
      error: { message: 'Too many requests', status: 429 },
    });

    await expect(
      queryClient.fetchQuery(usernameAvailabilityOptions('ada')),
    ).rejects.toThrow('Too many requests');
  });

  it('keys by the normalized username', () => {
    expect(usernameAvailabilityOptions('ADA').queryKey).toEqual([
      'auth',
      'username-availability',
      'ada',
    ]);
  });

  it.each([
    ['ada', true],
    ['ab', false],
    ['with space', false],
    ['x'.repeat(51), false],
  ])('enabled for %j: %s', (username, enabled) => {
    expect(usernameAvailabilityOptions(username).enabled).toBe(enabled);
  });
});
