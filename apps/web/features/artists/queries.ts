import 'server-only';

import {
  type ArtistTracksPage,
  artistSchema,
  artistTracksPageSchema,
  cacheTags,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { serverApi } from '@/lib/api/server';

import {
  type ArtistResult,
  artistFound,
  artistResultFromError,
} from './artist-result';

/**
 * The artist header outcome, cached by the requested ID (a new or a legacy
 * one). Catalog data only changes through reprocessing, which revalidates
 * the tag, so the longest life is correct; freshness comes from
 * invalidation, not expiry. Domain outcomes travel as data (see
 * `ArtistResult`): only genuine failures throw.
 */
export async function getArtistResult(artistId: string): Promise<ArtistResult> {
  'use cache';
  cacheTag(cacheTags.artist(artistId));
  cacheLife('max');

  try {
    return artistFound(
      await serverApi(`/artists/${encodeURIComponent(artistId)}`, {
        schema: artistSchema,
      }),
    );
  } catch (error) {
    const result = artistResultFromError(error);
    if (result) return result;
    throw error;
  }
}

export type ArtistTracksPageInput = {
  cursor?: string;
  limit?: number;
};

/**
 * One page of the artist's track table, cached per artist plus cursor.
 * Only called for a found artist (the page redirects moved/missing via
 * `getArtistResult` first), so failures throw and the table shows its
 * error UI with a retry.
 */
export async function getArtistTracksPage(
  artistId: string,
  input: ArtistTracksPageInput = {},
): Promise<ArtistTracksPage> {
  'use cache';
  cacheTag(cacheTags.artistTracks(artistId));
  cacheLife('max');

  return serverApi(`/artists/${encodeURIComponent(artistId)}/tracks`, {
    schema: artistTracksPageSchema,
    query: { cursor: input.cursor, limit: input.limit ?? 20 },
  });
}
