import type { CursorPage } from '@notefinder/contracts';
import {
  infiniteQueryOptions,
  keepPreviousData,
  type QueryKey,
} from '@tanstack/react-query';

export type CursorPagesInput<TItem> = {
  queryKey: QueryKey;
  fetchPage: (params: {
    cursor: string | undefined;
    signal: AbortSignal;
  }) => Promise<CursorPage<TItem>>;
  initialPage?: CursorPage<TItem>;
};

/**
 * Infinite options over any cursor-paginated list: the cursor travels as the
 * page param, the server-rendered first page hydrates the cache so only later
 * pages hit the network, and the signal aborts superseded fetches so stale
 * pages never overwrite fresh ones.
 */
export function cursorPagesQueryOptions<TItem>({
  queryKey,
  fetchPage,
  initialPage,
}: CursorPagesInput<TItem>) {
  return infiniteQueryOptions({
    // The previous pages stay on screen while the next one loads, so paging
    // never blanks the list.
    placeholderData: keepPreviousData,
    queryKey,
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | undefined;
      signal: AbortSignal;
    }) => fetchPage({ cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: CursorPage<TItem>) =>
      lastPage.nextCursor ?? undefined,
    initialData: initialPage
      ? { pages: [initialPage], pageParams: [undefined] }
      : undefined,
    staleTime: 60 * 1000,
  });
}

export type CursorPagesQuery<TItem> = ReturnType<
  typeof cursorPagesQueryOptions<TItem>
>;
