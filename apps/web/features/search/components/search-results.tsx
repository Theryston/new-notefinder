'use client';

import type { SearchResultItem, SearchScope } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { RequestTrackCard } from '@/features/tracks/components/request-track-card';
import { TrackCard } from '@/features/tracks/components/track-card';
import { TrackCardGrid } from '@/features/tracks/components/track-card-grid';
import { TrackCardMoreSkeletons } from '@/features/tracks/components/track-card-skeleton';

import { useSearchResults } from '../hooks/use-search-results';
import { offersTrackRequest } from '../search-result-action';
import { toTrackCardProps } from '../search-result-to-track-card';
import { SearchEmpty } from './search-empty';
import { SearchError } from './search-error';
import { SearchSkeleton } from './search-skeleton';

/**
 * The cards of the loaded hits. Signed-in visitors can ask for the notes of a
 * Recording without a Track; everyone else sees the static cards.
 */
function SearchResultCards({
  items,
  stale,
  loadingMore,
}: {
  items: SearchResultItem[];
  stale: boolean;
  loadingMore: boolean;
}) {
  return (
    <SessionUserBoundary
      render={(user) => (
        <TrackCardGrid stale={stale}>
          {items.map((item) =>
            offersTrackRequest(item, user) ? (
              <RequestTrackCard
                key={item.mbid}
                recordingMbid={item.mbid}
                {...toTrackCardProps(item)}
              />
            ) : (
              <TrackCard key={item.mbid} {...toTrackCardProps(item)} />
            ),
          )}
          {loadingMore ? <TrackCardMoreSkeletons /> : null}
        </TrackCardGrid>
      )}
    />
  );
}

/**
 * The result grid for a searchable query: best-first cards, infinite
 * scroll over limit plus offset, with loading, empty and retry states.
 */
export function SearchResults({
  query,
  scope,
}: {
  query: string;
  scope: SearchScope;
}) {
  const t = useTranslations('search');
  const results = useSearchResults({ query, scope });
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
    refetch,
  } = results;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isPending) return <SearchSkeleton />;
  if (error) return <SearchError onRetry={() => void refetch()} />;

  const items = data.pages.flatMap((page) => page.results);
  if (items.length === 0) return <SearchEmpty query={query} />;

  // A new query over known results: keep them on screen, dimmed and inert,
  // while the fetch runs. Paging appends skeletons instead, as before.
  const stale = isFetching && !isPending && !isFetchingNextPage;

  return (
    <div className="flex flex-col gap-4">
      <SearchResultCards
        items={items}
        stale={stale}
        loadingMore={isFetchingNextPage}
      />
      <Toaster />
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {hasNextPage ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mx-auto"
        >
          {t('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
