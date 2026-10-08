import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import { artistTracksInfiniteQueryOptions } from './use-artist-tracks';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

const firstPage = { items: [], nextCursor: 'cursor-2' };
const lastPage = { items: [], nextCursor: null };

describe('artistTracksInfiniteQueryOptions fetching', () => {
  it('fetches the artist track endpoint page by page, following the cursor', async () => {
    mockBrowserApi
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(lastPage);
    const client = new QueryClient();

    const result = await client.fetchInfiniteQuery({
      ...artistTracksInfiniteQueryOptions({ artistId: 'artist 1', limit: 5 }),
      pages: 2,
    });

    expect(mockBrowserApi).toHaveBeenNthCalledWith(
      1,
      '/artists/artist%201/tracks',
      {
        schema: expect.anything(),
        query: { cursor: undefined, limit: 5 },
        signal: expect.any(AbortSignal),
      },
    );
    expect(mockBrowserApi).toHaveBeenNthCalledWith(
      2,
      '/artists/artist%201/tracks',
      {
        schema: expect.anything(),
        query: { cursor: 'cursor-2', limit: 5 },
        signal: expect.any(AbortSignal),
      },
    );
    expect(result.pages).toEqual([firstPage, lastPage]);
  });

  it('uses the default page size when no limit is given', async () => {
    mockBrowserApi.mockResolvedValueOnce(lastPage);
    const client = new QueryClient();

    await client.fetchInfiniteQuery(
      artistTracksInfiniteQueryOptions({ artistId: 'artist-1' }),
    );

    expect(mockBrowserApi).toHaveBeenCalledWith('/artists/artist-1/tracks', {
      schema: expect.anything(),
      query: { cursor: undefined, limit: 20 },
      signal: expect.any(AbortSignal),
    });
  });
});
