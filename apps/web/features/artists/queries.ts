import 'server-only';

import { artistSchema, cacheTags } from '@notefinder/contracts';
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
