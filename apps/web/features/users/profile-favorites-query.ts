'use client';

import {
  type CatalogTrack,
  type UserFavoritesPage,
  userFavoritesPageSchema,
} from '@notefinder/contracts';
import { browserApi } from '@/lib/api/browser';
import { cursorPagesQueryOptions } from '@/lib/cursor-pages-query';

const PROFILE_FAVORITES_DEFAULT_LIMIT = 20;

/**
 * TanStack Query keys for a Profile's favorites grid. The username is
 * lowercase in the URL, so one Profile keeps one set of pages.
 */
export const profileFavoritesKeys = {
  infinite: (username: string, limit: number) =>
    ['users', username, 'favorites', 'infinite', { limit }] as const,
};

type ProfileFavoritesPageParams = {
  username: string;
  cursor?: string;
  limit: number;
  signal?: AbortSignal;
};

/**
 * One cursor page of a Profile's favorite Tracks
 * (`GET /v1/users/:username/favorites`), newest favorited first. The signal
 * aborts superseded fetches, so stale pages never overwrite fresh ones.
 */
export function fetchProfileFavoritesPage({
  username,
  cursor,
  limit,
  signal,
}: ProfileFavoritesPageParams): Promise<UserFavoritesPage> {
  return browserApi(`/users/${encodeURIComponent(username)}/favorites`, {
    schema: userFavoritesPageSchema,
    query: { cursor, limit },
    signal,
  });
}

export type ProfileFavoritesInfiniteInput = {
  username: string;
  limit?: number;
  initialPage?: UserFavoritesPage;
};

/**
 * The favorites grid as shared cursor paging, keyed by Profile plus page
 * size. The server-rendered first page hydrates the cache, so only later
 * pages hit the network.
 */
export function profileFavoritesInfiniteQueryOptions({
  username,
  limit = PROFILE_FAVORITES_DEFAULT_LIMIT,
  initialPage,
}: ProfileFavoritesInfiniteInput) {
  return cursorPagesQueryOptions<CatalogTrack>({
    queryKey: profileFavoritesKeys.infinite(username, limit),
    fetchPage: ({ cursor, signal }) =>
      fetchProfileFavoritesPage({ username, cursor, limit, signal }),
    initialPage,
  });
}
