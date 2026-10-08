'use client';

import type { CatalogTracksPage } from '@notefinder/contracts';
import { toCatalogTrackCardProps } from '@/features/tracks/components/catalog-track-to-track-card';
import { PaginatedTrackGrid } from '@/features/tracks/components/paginated-track-grid';
import type { TrackGridMessages } from '@/features/tracks/components/track-grid-messages';
import { artistTracksInfiniteQueryOptions } from '../artist-tracks-query';

/**
 * The artist page's track grid: the shared paginated grid bound to the
 * artist's track list. The artist page shows one flat grid, so no grouping.
 */
export function ArtistTracksGrid({
  artistId,
  initialPage,
  messages,
}: {
  artistId: string;
  initialPage?: CatalogTracksPage;
  messages: TrackGridMessages;
}) {
  return (
    <PaginatedTrackGrid
      headingId="artist-tracks-title"
      messages={messages}
      query={artistTracksInfiniteQueryOptions({ artistId, initialPage })}
      toCardProps={toCatalogTrackCardProps}
    />
  );
}
