'use client';

import {
  type AlbumTrack,
  type AlbumTracksPage,
  albumTracksPageSchema,
} from '@notefinder/contracts';
import { browserApi } from '@/lib/api/browser';
import { cursorPagesQueryOptions } from '@/lib/cursor-pages-query';

import { ALBUM_TRACKS_PAGE_SIZE, albumKeys } from './query-keys';

type AlbumTracksPageParams = {
  albumId: string;
  cursor?: string;
  limit: number;
  signal?: AbortSignal;
};

/**
 * One cursor page of the album track list (`GET /v1/albums/:id/tracks`), in
 * album order. The signal aborts superseded fetches, so stale pages never
 * overwrite fresh ones.
 */
export function fetchAlbumTracksPage({
  albumId,
  cursor,
  limit,
  signal,
}: AlbumTracksPageParams): Promise<AlbumTracksPage> {
  return browserApi(`/albums/${encodeURIComponent(albumId)}/tracks`, {
    schema: albumTracksPageSchema,
    query: { cursor, limit },
    signal,
  });
}

export type AlbumTracksInfiniteInput = {
  albumId: string;
  limit?: number;
  initialPage?: AlbumTracksPage;
};

/**
 * The album's track list as shared cursor paging, keyed by album plus page
 * size. The paging itself lives in `lib/cursor-pages-query`, shared with every
 * other track list.
 */
export function albumTracksInfiniteQueryOptions({
  albumId,
  limit = ALBUM_TRACKS_PAGE_SIZE,
  initialPage,
}: AlbumTracksInfiniteInput) {
  return cursorPagesQueryOptions<AlbumTrack>({
    queryKey: albumKeys.infiniteTracks(albumId, limit),
    fetchPage: ({ cursor, signal }) =>
      fetchAlbumTracksPage({ albumId, cursor, limit, signal }),
    initialPage,
  });
}
