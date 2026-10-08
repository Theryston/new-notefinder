'use client';

import {
  type CatalogTracksPage,
  catalogTracksPageSchema,
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
 * One cursor page of the artist track list
 * (`GET /v1/artists/:id/tracks`), in stable `id` order. The signal aborts
 * superseded fetches, so stale pages never overwrite fresh ones.
 */
export function fetchArtistTracksPage({
  artistId,
  cursor,
  limit,
  signal,
}: ArtistTracksPageParams): Promise<CatalogTracksPage> {
  return browserApi(`/artists/${encodeURIComponent(artistId)}/tracks`, {
    schema: catalogTracksPageSchema,
    query: { cursor, limit },
    signal,
  });
}

export type ArtistTracksInfiniteInput = {
  artistId: string;
  limit?: number;
  initialPage?: CatalogTracksPage;
};

/**
 * Infinite track cards keyed by artist plus page size (the cursor travels
 * as the page param). The server-rendered first page hydrates it, so the
 * grid shows instantly and only later pages hit the network.
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
    getNextPageParam: (lastPage: CatalogTracksPage) =>
      lastPage.nextCursor ?? undefined,
    initialData: initialPage
      ? { pages: [initialPage], pageParams: [undefined] }
      : undefined,
    staleTime: 60 * 1000,
  });
}

/** Paginated track cards for the artist page grid. */
export function useArtistTracks(input: ArtistTracksInfiniteInput) {
  return useInfiniteQuery(artistTracksInfiniteQueryOptions(input));
}
