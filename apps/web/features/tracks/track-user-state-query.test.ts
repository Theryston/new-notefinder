import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  setTrackFavorite,
  trackUserStateQueryOptions,
} from './track-user-state-query';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);
const signal = new AbortController().signal;

describe('trackUserStateQueryOptions', () => {
  it('reads the state from the browser, keyed by Track', async () => {
    const options = trackUserStateQueryOptions('a/b');
    mockBrowserApi.mockResolvedValue({ isFavorite: true });

    await options.queryFn?.({ signal } as never);

    expect(options.queryKey).toEqual(['tracks', 'a/b', 'user-state']);
    expect(mockBrowserApi).toHaveBeenCalledWith('/me/tracks/a%2Fb', {
      schema: expect.anything(),
      signal,
    });
  });
});

describe('setTrackFavorite', () => {
  it('favorites with PUT', async () => {
    mockBrowserApi.mockResolvedValue(undefined);

    await setTrackFavorite('a/b', true);

    expect(mockBrowserApi).toHaveBeenCalledWith('/me/favorites/a%2Fb', {
      method: 'PUT',
      schema: expect.anything(),
    });
  });

  it('unfavorites with DELETE', async () => {
    mockBrowserApi.mockResolvedValue(undefined);

    await setTrackFavorite('t1', false);

    expect(mockBrowserApi).toHaveBeenCalledWith('/me/favorites/t1', {
      method: 'DELETE',
      schema: expect.anything(),
    });
  });
});
