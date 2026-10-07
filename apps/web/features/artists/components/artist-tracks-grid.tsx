'use client';

import type { ArtistTracksPage } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { TrackCard } from '@/features/tracks/components/track-card';
import { TrackCardGrid } from '@/features/tracks/components/track-card-grid';
import {
  TrackCardMoreSkeletons,
  TrackCardSkeleton,
} from '@/features/tracks/components/track-card-skeleton';

import { toArtistTrackCardProps } from '../artist-track-to-track-card';
import {
  ARTIST_TRACKS_DEFAULT_LIMIT,
  useArtistTracks,
} from '../hooks/use-artist-tracks';
import { ArtistTracksEmpty, ArtistTracksError } from './artist-tracks-feedback';

/** Twelve placeholders fill the grid at every breakpoint. */
const SKELETON_KEYS = Array.from(
  { length: 12 },
  (_, index) => `skeleton-${index}`,
);

/**
 * The section frame: the "Tracks" heading stays mounted through loading,
 * error and empty states, so assistive tech keeps the context whatever
 * the grid is doing.
 */
function TracksSection({ children }: { children: ReactNode }) {
  const t = useTranslations('artists');
  return (
    <section
      aria-labelledby="artist-tracks-title"
      className="flex flex-col gap-4"
    >
      <h2 id="artist-tracks-title" className="font-bold text-xl">
        {t('tracks.title')}
      </h2>
      {children}
    </section>
  );
}

/**
 * Same-dimension placeholders for the track grid while it loads, so the
 * page does not jump. The shared card grid keeps the exact density of the
 * final cards.
 */
export function ArtistTracksGridSkeleton() {
  const t = useTranslations('artists');
  return (
    <div role="status" aria-label={t('tracks.loading')}>
      <TrackCardGrid>
        {SKELETON_KEYS.map((key) => (
          <TrackCardSkeleton key={key} />
        ))}
      </TrackCardGrid>
    </div>
  );
}

/**
 * Pagination controls below the grid: an infinite-scroll sentinel plus
 * an explicit button, with a status line while the next page loads.
 */
function TracksGridMore({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations('artists');
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {isFetchingNextPage ? (
        <p role="status" className="text-center text-muted-foreground text-sm">
          {t('tracks.loadingMore')}
        </p>
      ) : null}
      {hasNextPage ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="mx-auto"
        >
          {t('tracks.loadMore')}
        </Button>
      ) : null}
    </>
  );
}

/**
 * The artist's processed tracks as a cover grid: one generic card per
 * Track (title, performer subtitle, first-release cover or placeholder),
 * every card linking to its Track page. Paginates in place (infinite
 * scroll plus an explicit button) and keeps the server-rendered first
 * page while later pages load.
 */
export function ArtistTracksGrid({
  artistId,
  initialPage,
}: {
  artistId: string;
  initialPage?: ArtistTracksPage;
}) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useArtistTracks({
    artistId,
    limit: ARTIST_TRACKS_DEFAULT_LIMIT,
    initialPage,
  });

  if (isPending) {
    return (
      <TracksSection>
        <ArtistTracksGridSkeleton />
      </TracksSection>
    );
  }
  if (error) {
    return (
      <TracksSection>
        <ArtistTracksError onRetry={() => void refetch()} />
      </TracksSection>
    );
  }

  const items = data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <TracksSection>
        <ArtistTracksEmpty />
      </TracksSection>
    );
  }

  return (
    <TracksSection>
      <TrackCardGrid>
        {items.map((track) => (
          <TrackCard key={track.id} {...toArtistTrackCardProps(track)} />
        ))}
        {isFetchingNextPage ? <TrackCardMoreSkeletons /> : null}
      </TrackCardGrid>
      <TracksGridMore
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
      />
    </TracksSection>
  );
}
