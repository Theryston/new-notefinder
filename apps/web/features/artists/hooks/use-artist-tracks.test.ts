import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  artistTracksInfiniteQueryOptions,
  fetchArtistTracksPage,
} from './use-artist-tracks';

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
    },
  ],
  nextCursor: 'cursor-2',
};

describe('artistTracksInfiniteQueryOptions', () => {
  it('keys pages by artist and limit with the cursor as page param', () => {
    const options = artistTracksInfiniteQueryOptions({
      artistId: 'artist-1',
      limit: 20,
    });

    expect(options.queryKey).toEqual([
      'artists',
      'artist-1',
      'tracks',
      'infinite',
      { limit: 20 },
    ]);
    expect(options.initialPageParam).toBeUndefined();
  });

  it('continues while the API answers a cursor', () => {
    const options = artistTracksInfiniteQueryOptions({ artistId: 'artist-1' });

    expect(options.getNextPageParam?.(page, [], undefined, [])).toBe(
      'cursor-2',
    );
    expect(
      options.getNextPageParam?.(
        { items: [], nextCursor: null },
        [],
        undefined,
        [],
      ),
    ).toBeUndefined();
  });

  it('hydrates the server-rendered first page', () => {
    const options = artistTracksInfiniteQueryOptions({
      artistId: 'artist-1',
      initialPage: page,
    });

    expect(options.initialData).toEqual({
      pages: [page],
      pageParams: [undefined],
    });
  });
});

describe('fetchArtistTracksPage', () => {
  it('fetches one cursor page through the browser client', async () => {
    mockBrowserApi.mockResolvedValue(page);
    const signal = AbortSignal.timeout(1000);

    await expect(
      fetchArtistTracksPage({
        artistId: 'artist-1',
        cursor: 'cursor-1',
        limit: 20,
        signal,
      }),
    ).resolves.toEqual(page);
    expect(mockBrowserApi).toHaveBeenCalledWith('/artists/artist-1/tracks', {
      schema: expect.anything(),
      query: { cursor: 'cursor-1', limit: 20 },
      signal,
    });
  });
});
