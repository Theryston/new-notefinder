'use client';

import {
  type ArtistTracksPage,
  artistTracksPageSchema,
} from '@notefinder/contracts';
import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { browserApi } from '@/lib/api/browser';

import { artistKeys } from '../query-keys';

export const ARTIST_TRACKS_DEFAULT_LIMIT = 20;

type ArtistTracksPageParams = {
  artistId: string;
  cursor?: string;
  limit: number;
  signal?: AbortSignal;
};

/**
 * One cursor page of the artist track table
 * (`GET /v1/artists/:id/tracks`), in stable `id` order. The signal aborts
 * superseded fetches, so stale pages never overwrite fresh ones.
 */
export function fetchArtistTracksPage({
  artistId,
  cursor,
  limit,
  signal,
}: ArtistTracksPageParams): Promise<ArtistTracksPage> {
  return browserApi(`/artists/${encodeURIComponent(artistId)}/tracks`, {
    schema: artistTracksPageSchema,
    query: { cursor, limit },
    signal,
  });
}

export type ArtistTracksInfiniteInput = {
  artistId: string;
  limit?: number;
  initialPage?: ArtistTracksPage;
};

/**
 * Infinite track rows keyed by artist plus page size (the cursor travels
 * as the page param). The server-rendered first page hydrates it, so the
 * table shows instantly and only later pages hit the network.
 */
export function artistTracksInfiniteQueryOptions({
  artistId,
  limit = ARTIST_TRACKS_DEFAULT_LIMIT,
  initialPage,
}: ArtistTracksInfiniteInput) {
  return infiniteQueryOptions({
    placeholderData: keepPreviousData,
    queryKey: artistKeys.infiniteTracks(artistId, limit),
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | undefined;
      signal: AbortSignal;
    }) =>
      fetchArtistTracksPage({
        artistId,
        cursor: pageParam,
        limit,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ArtistTracksPage) =>
      lastPage.nextCursor ?? undefined,
    initialData: initialPage
      ? { pages: [initialPage], pageParams: [undefined] }
      : undefined,
    staleTime: 60 * 1000,
  });
}

/** Paginated track rows for the artist page table. */
export function useArtistTracks(input: ArtistTracksInfiniteInput) {
  return useInfiniteQuery(artistTracksInfiniteQueryOptions(input));
}
