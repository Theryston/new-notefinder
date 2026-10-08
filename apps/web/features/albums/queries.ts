import 'server-only';

import {
  type AlbumTracksPage,
  albumSchema,
  albumTracksPageSchema,
  cacheTags,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';

import {
  type AlbumResult,
  albumFound,
  albumResultFromError,
} from './album-result';
import { ALBUM_TRACKS_PAGE_SIZE } from './query-keys';

/**
 * The album header outcome, cached by the requested ID (a new or a legacy
 * one). Catalog data only changes through reprocessing, which revalidates
 * the tag, so the longest life is correct; freshness comes from
 * invalidation, not expiry. Domain outcomes travel as data (see
 * `AlbumResult`): only genuine failures throw.
 */
export async function getAlbumResult(albumId: string): Promise<AlbumResult> {
  'use cache';
  cacheTag(cacheTags.album(albumId));
  cacheLife('max');

  try {
    return albumFound(
      await serverApi(`/albums/${encodeURIComponent(albumId)}`, {
        schema: albumSchema,
      }),
    );
  } catch (error) {
    const result = albumResultFromError(error);
    if (result) return result;
    throw error;
  }
}

/**
 * The first page of the album's track grid, cached per album. Only called
 * for a found album (the page redirects moved/missing via `getAlbumResult`
 * first), so failures throw and the grid shows its error UI with a retry.
 */
export async function getAlbumTracksPage(
  albumId: string,
): Promise<AlbumTracksPage> {
  'use cache';
  cacheTag(cacheTags.albumTracks(albumId));
  cacheLife('max');

  return serverApi(`/albums/${encodeURIComponent(albumId)}/tracks`, {
    schema: albumTracksPageSchema,
    query: { limit: ALBUM_TRACKS_PAGE_SIZE },
  });
}
