'use client';

import type { ArtistTracksPage } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';

import {
  ARTIST_TRACKS_DEFAULT_LIMIT,
  useArtistTracks,
} from '../hooks/use-artist-tracks';
import { ArtistTrackRow } from './artist-track-row';
import { ArtistTrackTableSkeleton } from './artist-track-table-skeleton';
import { ArtistTracksEmpty, ArtistTracksError } from './artist-tracks-feedback';

function TrackTableHead() {
  const t = useTranslations('artists');
  return (
    <thead>
      <tr className="border-border border-b text-left text-muted-foreground text-xs uppercase">
        <th scope="col" className="px-4 py-3 font-semibold">
          {t('tracks.columns.title')}
        </th>
        <th scope="col" className="px-4 py-3 font-semibold">
          {t('tracks.columns.artists')}
        </th>
        <th scope="col" className="px-4 py-3 font-semibold">
          {t('tracks.columns.duration')}
        </th>
        <th scope="col" className="px-4 py-3 font-semibold">
          {t('tracks.columns.isrcs')}
        </th>
        <th scope="col" className="px-4 py-3 font-semibold">
          {t('tracks.columns.genres')}
        </th>
      </tr>
    </thead>
  );
}

/**
 * The section frame: the "Tracks" heading stays mounted through loading,
 * error and empty states, so assistive tech keeps the context whatever
 * the table is doing.
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
 * Pagination controls below the table: an infinite-scroll sentinel plus
 * an explicit button, with a status line while the next page loads.
 */
function TrackTableMore({
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
 * The artist's processed tracks as a paginated table: core columns up
 * front, every row linking to the future track page. Paginates in place
 * (infinite scroll plus an explicit button), stays horizontally
 * scrollable on small screens, and keeps the server-rendered first page
 * while later pages load.
 */
export function ArtistTrackTable({
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
        <ArtistTrackTableSkeleton />
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
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <TrackTableHead />
          <tbody>
            {items.map((track) => (
              <ArtistTrackRow key={track.id} track={track} />
            ))}
          </tbody>
        </table>
      </div>
      <TrackTableMore
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
      />
    </TracksSection>
  );
}
