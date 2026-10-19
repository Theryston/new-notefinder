'use client';

import type { UserFavoritesPage } from '@notefinder/contracts';
import type { ReactNode } from 'react';

import { toCatalogTrackCardProps } from '@/features/tracks/components/catalog-track-to-track-card';
import { PaginatedTrackGrid } from '@/features/tracks/components/paginated-track-grid';
import type { TrackGridMessages } from '@/features/tracks/components/track-grid-messages';

import { profileFavoritesInfiniteQueryOptions } from '../profile-favorites-query';

/**
 * The favorites cover grid of a Profile: the shared paginated grid bound to
 * the Profile's favorites, starting from the server-rendered first page.
 * `headerAction` sits on the grid's title row (the owner's section toggle).
 */
export function ProfileFavoritesGrid({
  username,
  initialPage,
  messages,
  headerAction,
}: {
  username: string;
  initialPage: UserFavoritesPage;
  messages: TrackGridMessages;
  headerAction?: ReactNode;
}) {
  return (
    <PaginatedTrackGrid
      headingId="profile-favorites-title"
      messages={messages}
      query={profileFavoritesInfiniteQueryOptions({ username, initialPage })}
      toCardProps={toCatalogTrackCardProps}
      headerAction={headerAction}
    />
  );
}
