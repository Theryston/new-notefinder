import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import {
  applyFavorite,
  rollbackFavorite,
  settleFavorite,
} from './favorite-optimistic';

const key = ['tracks', 't1', 'user-state'] as const;

describe('applyFavorite', () => {
  it('writes the new state at once and returns the one before', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, { isFavorite: false });

    const snapshot = await applyFavorite(queryClient, key, true);

    expect(queryClient.getQueryData(key)).toEqual({ isFavorite: true });
    expect(snapshot).toEqual({ previous: { isFavorite: false } });
  });

  it('has nothing to return when the state was never read', async () => {
    const queryClient = new QueryClient();

    const snapshot = await applyFavorite(queryClient, key, true);

    expect(snapshot).toEqual({ previous: undefined });
  });

  it('cancels a read in flight so it cannot undo the write', async () => {
    const queryClient = new QueryClient();
    let resolveRead: (value: { isFavorite: boolean }) => void = () => {};
    const read = queryClient.fetchQuery({
      queryKey: key,
      queryFn: () =>
        new Promise<{ isFavorite: boolean }>((resolve) => {
          resolveRead = resolve;
        }),
    });
    read.catch(() => undefined);

    await applyFavorite(queryClient, key, true);
    resolveRead({ isFavorite: false });

    expect(queryClient.getQueryData(key)).toEqual({ isFavorite: true });
  });
});

describe('rollbackFavorite', () => {
  it('puts the previous state back and names the error to toast', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, { isFavorite: true });
    const error = new ApiError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Track not found',
    });

    const message = rollbackFavorite(
      queryClient,
      key,
      { previous: { isFavorite: false } },
      error,
    );

    expect(queryClient.getQueryData(key)).toEqual({ isFavorite: false });
    expect(message).toEqual({ key: 'errors.NOT_FOUND' });
  });

  it('falls back to the generic message for an error that is not the API', () => {
    const queryClient = new QueryClient();

    const message = rollbackFavorite(
      queryClient,
      key,
      undefined,
      new Error('offline'),
    );

    expect(message).toEqual({ key: 'errors.INTERNAL_ERROR' });
  });
});

describe('settleFavorite', () => {
  it('marks the state stale so it is read again', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, { isFavorite: true });

    await settleFavorite(queryClient, key);

    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
