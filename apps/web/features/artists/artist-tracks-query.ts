'use client';

import {
  type CatalogTrack,
  type CatalogTracksPage,
  catalogTracksPageSchema,
} from '@notefinder/contracts';
import { browserApi } from '@/lib/api/browser';
import { cursorPagesQueryOptions } from '@/lib/cursor-pages-query';

import { artistKeys } from './query-keys';

const ARTIST_TRACKS_DEFAULT_LIMIT = 20;

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
 * The artist's track list as shared cursor paging, keyed by artist plus
 * page size. This binds the artist's key and endpoint; the paging itself
 * lives in `lib/cursor-pages-query`, shared with every other track list.
 */
export function artistTracksInfiniteQueryOptions({
  artistId,
  limit = ARTIST_TRACKS_DEFAULT_LIMIT,
  initialPage,
}: ArtistTracksInfiniteInput) {
  return cursorPagesQueryOptions<CatalogTrack>({
    queryKey: artistKeys.infiniteTracks(artistId, limit),
    fetchPage: ({ cursor, signal }) =>
      fetchArtistTracksPage({ artistId, cursor, limit, signal }),
    initialPage,
  });
}
