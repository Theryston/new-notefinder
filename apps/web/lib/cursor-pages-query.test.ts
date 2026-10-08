import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  type CursorPagesInput,
  cursorPagesQueryOptions,
} from './cursor-pages-query';

const firstPage = { items: ['a', 'b'], nextCursor: 'cursor-2' };
const lastPage = { items: ['c'], nextCursor: null };

function optionsWith(
  fetchPage: CursorPagesInput<string>['fetchPage'],
  initialPage?: typeof firstPage,
) {
  return cursorPagesQueryOptions<string>({
    queryKey: ['list', 'items'],
    fetchPage,
    initialPage,
  });
}

describe('cursorPagesQueryOptions', () => {
  it('keys the query by the given key and starts without a cursor', () => {
    const options = optionsWith(vi.fn());

    expect(options.queryKey).toEqual(['list', 'items']);
    expect(options.initialPageParam).toBeUndefined();
  });

  it('continues while the page answers a cursor and stops at the end', () => {
    const options = optionsWith(vi.fn());

    expect(options.getNextPageParam?.(firstPage, [], undefined, [])).toBe(
      'cursor-2',
    );
    expect(options.getNextPageParam?.(lastPage, [], undefined, [])).toBe(
      undefined,
    );
  });

  it('hydrates the cache with the server-rendered first page', () => {
    const options = optionsWith(vi.fn(), firstPage);

    expect(options.initialData).toEqual({
      pages: [firstPage],
      pageParams: [undefined],
    });
  });

  it('leaves the cache empty without a server-rendered page', () => {
    expect(optionsWith(vi.fn()).initialData).toBeUndefined();
  });

  it('keeps a list fresh for a minute before refetching it', () => {
    expect(optionsWith(vi.fn()).staleTime).toBe(60 * 1000);
  });

  it('fetches each page with the cursor it was given, then the next one', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(lastPage);
    const client = new QueryClient();

    const result = await client.fetchInfiniteQuery({
      ...optionsWith(fetchPage),
      pages: 2,
    });

    expect(fetchPage).toHaveBeenNthCalledWith(1, {
      cursor: undefined,
      signal: expect.any(AbortSignal),
    });
    expect(fetchPage).toHaveBeenNthCalledWith(2, {
      cursor: 'cursor-2',
      signal: expect.any(AbortSignal),
    });
    expect(result.pages).toEqual([firstPage, lastPage]);
  });
});
