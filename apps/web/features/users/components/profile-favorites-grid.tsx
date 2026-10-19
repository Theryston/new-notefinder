'use client';

import type { UserFavoritesPage } from '@notefinder/contracts';

import { toCatalogTrackCardProps } from '@/features/tracks/components/catalog-track-to-track-card';
import { PaginatedTrackGrid } from '@/features/tracks/components/paginated-track-grid';
import type { TrackGridMessages } from '@/features/tracks/components/track-grid-messages';

import { profileFavoritesInfiniteQueryOptions } from '../profile-favorites-query';

/**
 * The favorites cover grid of a Profile: the shared paginated grid bound to
 * the Profile's favorites, starting from the server-rendered first page.
 */
export function ProfileFavoritesGrid({
  username,
  initialPage,
  messages,
}: {
  username: string;
  initialPage: UserFavoritesPage;
  messages: TrackGridMessages;
}) {
  return (
    <PaginatedTrackGrid
      headingId="profile-favorites-title"
      messages={messages}
      query={profileFavoritesInfiniteQueryOptions({ username, initialPage })}
      toCardProps={toCatalogTrackCardProps}
    />
  );
}
