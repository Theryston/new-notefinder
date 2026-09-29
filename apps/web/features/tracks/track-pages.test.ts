import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackPagesOptions } from './track-pages';

const fetchMock = vi.fn<typeof fetch>();

const collection = { kind: 'artist', id: 'a1' } as const;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
  vi.stubGlobal('fetch', fetchMock);
});

describe('trackPagesOptions', () => {
  it('starts at the cursor after the first page, keyed by it', () => {
    const options = trackPagesOptions(collection, 'c1', false);

    expect(options.queryKey).toEqual(['tracks', 'artist', 'a1', 'pages', 'c1']);
    expect(options.initialPageParam).toBe('c1');
    expect(options.enabled).toBe(false);
    expect(options.staleTime).toBe(Number.POSITIVE_INFINITY);
  });

  it('follows nextCursor until the last page', () => {
    const { getNextPageParam } = trackPagesOptions(collection, 'c1', true);
    const next = (nextCursor: string | null) =>
      getNextPageParam({ items: [], nextCursor }, [], 'c1', ['c1']);

    expect(next('c2')).toBe('c2');
    expect(next(null)).toBeUndefined();
  });

  it('fetches each page from its cursor', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ items: [], nextCursor: 'c2' }))
      .mockResolvedValueOnce(Response.json({ items: [], nextCursor: null }));
    const client = new QueryClient();
    const options = trackPagesOptions(collection, 'c1', true);

    const data = await client.fetchInfiniteQuery({ ...options, pages: 2 });

    expect(data.pageParams).toEqual(['c1', 'c2']);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'http://api.test/v1/artists/a1/tracks?cursor=c1&limit=24',
      'http://api.test/v1/artists/a1/tracks?cursor=c2&limit=24',
    ]);
  });
});
