'use client';

import type { CatalogTracksPage } from '@notefinder/contracts';

import { PaginatedTrackGrid } from '@/features/tracks/components/paginated-track-grid';
import type { TrackGridMessages } from '@/features/tracks/components/track-grid-messages';

import { toCatalogTrackCardProps } from '../artist-track-to-track-card';
import { artistTracksInfiniteQueryOptions } from '../hooks/use-artist-tracks';

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
