import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  fetchProfileFavoritesPage,
  profileFavoritesInfiniteQueryOptions,
} from './profile-favorites-query';
import { profileKeys } from './query-keys';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

const page = { items: [], nextCursor: 'cursor-2' };

const lastPage = { items: [], nextCursor: null };

describe('profileFavoritesInfiniteQueryOptions keys', () => {
  it('keys the grid with the shared Profile favorites keys', () => {
    expect(
      profileFavoritesInfiniteQueryOptions({
        username: 'ada_lovelace',
        limit: 20,
      }).queryKey,
    ).toEqual(profileKeys.infiniteFavorites('ada_lovelace', 20));
  });
});

describe('fetchProfileFavoritesPage', () => {
  it('reads the favorites endpoint of the encoded username with the cursor', async () => {
    mockBrowserApi.mockResolvedValueOnce(page);

    await fetchProfileFavoritesPage({
      username: 'ada lovelace',
      cursor: 'cursor-1',
      limit: 5,
    });

    expect(mockBrowserApi).toHaveBeenCalledWith(
      '/users/ada%20lovelace/favorites',
      {
        schema: expect.anything(),
        query: { cursor: 'cursor-1', limit: 5 },
        signal: undefined,
      },
    );
  });
});

describe('profileFavoritesInfiniteQueryOptions', () => {
  it('starts from the server-rendered first page without a page param', () => {
    const options = profileFavoritesInfiniteQueryOptions({
      username: 'ada_lovelace',
      initialPage: page,
    });

    expect(options.initialPageParam).toBeUndefined();
    expect(options.initialData).toEqual({
      pages: [page],
      pageParams: [undefined],
    });
  });

  it('fetches the next page by following the cursor', async () => {
    mockBrowserApi.mockResolvedValueOnce(page).mockResolvedValueOnce(lastPage);
    const client = new QueryClient();

    const result = await client.fetchInfiniteQuery({
      ...profileFavoritesInfiniteQueryOptions({
        username: 'ada_lovelace',
        limit: 5,
      }),
      pages: 2,
    });

    expect(result.pages).toEqual([page, lastPage]);
    expect(mockBrowserApi).toHaveBeenNthCalledWith(
      2,
      '/users/ada_lovelace/favorites',
      {
        schema: expect.anything(),
        query: { cursor: 'cursor-2', limit: 5 },
        signal: expect.any(AbortSignal),
      },
    );
  });
});
