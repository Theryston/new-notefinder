'use client';

import type { AlbumTracksPage } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { PaginatedTrackGrid } from '@/features/tracks/components/paginated-track-grid';
import type { TrackGridMessages } from '@/features/tracks/components/track-grid-messages';

import { albumTrackGroupBy } from '../album-disc-headings';
import { toAlbumTrackCardProps } from '../album-track-to-track-card';
import { albumTracksInfiniteQueryOptions } from '../album-tracks-query';

/**
 * The album page's track grid: the shared paginated grid bound to the
 * album's track list, grouped under a heading per disc. The disc headings
 * are formatted here, from the `albums.tracks.disc` templates the section
 * passed down.
 */
export function AlbumTracksGrid({
  albumId,
  initialPage,
  messages,
}: {
  albumId: string;
  initialPage?: AlbumTracksPage;
  messages: TrackGridMessages;
}) {
  const t = useTranslations('albums.tracks');
  const groupBy = albumTrackGroupBy({
    numbered: (number) => t('disc.numbered', { number }),
    named: (number, title) => t('disc.named', { number, title }),
  });

  return (
    <PaginatedTrackGrid
      headingId="album-tracks-title"
      messages={messages}
      query={albumTracksInfiniteQueryOptions({ albumId, initialPage })}
      toCardProps={toAlbumTrackCardProps}
      groupBy={groupBy}
    />
  );
}
