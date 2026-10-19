import 'server-only';

import {
  cacheTags,
  type PublicProfile,
  type PublicProfileSummary,
  publicProfileSchema,
  publicProfileSummarySchema,
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
 * The Summary numbers of a Profile. Read on every request rather than cached:
 * they move with each practice run, favorite and contribution, and no cache
 * tag covers those yet. An unknown username is `null`, as for the banner.
 */
export async function getPublicProfileSummary(
  username: string,
): Promise<PublicProfileSummary | null> {
  try {
    return await serverApi(`/users/${encodeURIComponent(username)}/summary`, {
      schema: publicProfileSummarySchema,
    });
  } catch (error) {
    if (isApiError(error) && error.code === 'NOT_FOUND') {
      return null;
    }
    throw error;
  }
}
