import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  albumTracksInfiniteQueryOptions,
  fetchAlbumTracksPage,
} from './album-tracks-query';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

const page = {
  items: [
    {
      id: 'track-1',
      title: 'Bohemian Rhapsody',
      lengthMs: 354_000,
      disambiguation: '',
      video: false,
      isrcs: [],
      artists: [{ id: 'artist-1', name: 'Queen' }],
      genres: [],
      disc: { position: 1, title: null },
    },
  ],
  nextCursor: 'cursor-2',
};

const lastPage = { items: [], nextCursor: null };

describe('albumTracksInfiniteQueryOptions', () => {
  it('keys pages by album and limit with the cursor as page param', () => {
    const options = albumTracksInfiniteQueryOptions({
      albumId: 'album-1',
      limit: 20,
    });

    expect(options.queryKey).toEqual([
      'albums',
      'album-1',
      'tracks',
      'infinite',
      { limit: 20 },
    ]);
    expect(options.initialPageParam).toBeUndefined();
  });

  it('fetches the album track endpoint page by page, following the cursor', async () => {
    mockBrowserApi.mockResolvedValueOnce(page).mockResolvedValueOnce(lastPage);
    const client = new QueryClient();

    const result = await client.fetchInfiniteQuery({
      ...albumTracksInfiniteQueryOptions({ albumId: 'album 1', limit: 5 }),
      pages: 2,
    });

    expect(mockBrowserApi).toHaveBeenNthCalledWith(
      1,
      '/albums/album%201/tracks',
      {
        schema: expect.anything(),
        query: { cursor: undefined, limit: 5 },
        signal: expect.any(AbortSignal),
      },
    );
    expect(mockBrowserApi).toHaveBeenNthCalledWith(
      2,
      '/albums/album%201/tracks',
      {
        schema: expect.anything(),
        query: { cursor: 'cursor-2', limit: 5 },
        signal: expect.any(AbortSignal),
      },
    );
    expect(result.pages).toEqual([page, lastPage]);
  });

  it('uses the shared page size when no limit is given', async () => {
    mockBrowserApi.mockResolvedValueOnce(lastPage);
    const client = new QueryClient();

    await client.fetchInfiniteQuery(
      albumTracksInfiniteQueryOptions({ albumId: 'album-1' }),
    );

    expect(mockBrowserApi).toHaveBeenCalledWith('/albums/album-1/tracks', {
      schema: expect.anything(),
      query: { cursor: undefined, limit: 20 },
      signal: expect.any(AbortSignal),
    });
  });
});

describe('fetchAlbumTracksPage', () => {
  it('fetches one cursor page through the browser client', async () => {
    mockBrowserApi.mockResolvedValue(page);
    const signal = AbortSignal.timeout(1000);

    await expect(
      fetchAlbumTracksPage({
        albumId: 'album-1',
        cursor: 'cursor-1',
        limit: 20,
        signal,
      }),
    ).resolves.toEqual(page);
    expect(mockBrowserApi).toHaveBeenCalledWith('/albums/album-1/tracks', {
      schema: expect.anything(),
      query: { cursor: 'cursor-1', limit: 20 },
      signal,
    });
  });
});
