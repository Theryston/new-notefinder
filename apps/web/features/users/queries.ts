import 'server-only';

import {
  cacheTags,
  type PublicProfile,
  publicProfileSchema,
  type UserFavoritesPage,
  userFavoritesPageSchema,
} from '@notefinder/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { isApiError } from '@/lib/api/api-error';
import { serverApi } from '@/lib/api/server';

/**
 * The public banner of a Profile, cached under the Profile tag the API
 * revalidates when the Name or Avatar changes. An unknown username is `null`
 * rather than an error: the page answers it with a 404.
 */
export async function getPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  'use cache';
  cacheTag(cacheTags.userProfile(username));
  cacheLife('max');

  try {
    return await serverApi(`/users/${encodeURIComponent(username)}`, {
      schema: publicProfileSchema,
    });
  } catch (error) {
    if (isApiError(error) && error.code === 'NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

/**
 * The first page of a Profile's favorite Tracks, cached under its own favorites
 * tag (the API revalidates it when a favorite changes), so banner edits and
 * favorite changes do not evict each other. Later pages are read by the grid.
 */
export async function getPublicFavoritesPage(
  username: string,
): Promise<UserFavoritesPage> {
  'use cache';
  cacheTag(cacheTags.userFavorites(username));
  cacheLife('max');

  return serverApi(`/users/${encodeURIComponent(username)}/favorites`, {
    schema: userFavoritesPageSchema,
  });
}
