'use client';

import type { SearchScope } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { TrackCard } from '@/features/tracks/components/track-card';
import { cn } from '@/lib/utils';

import { useSearchResults } from '../hooks/use-search-results';
import { toTrackCardProps } from '../search-result-to-track-card';
import { SearchCardSkeleton } from './search-card-skeleton';
import { SearchEmpty } from './search-empty';
import { SearchError } from './search-error';
import { SearchSkeleton } from './search-skeleton';

/** Seven more card blocks appended while the next page loads. */
function MoreSkeletonCards() {
  return (
    <>
      {[
        'more-0',
        'more-1',
        'more-2',
        'more-3',
        'more-4',
        'more-5',
        'more-6',
      ].map((key) => (
        <SearchCardSkeleton key={key} />
      ))}
    </>
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
      <div
        data-stale={stale || undefined}
        aria-busy={stale}
        inert={stale}
        className={cn(
          'grid grid-cols-2 gap-2 transition-opacity duration-150 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
          stale && 'pointer-events-none opacity-50',
        )}
      >
        {items.map((item) => (
          <TrackCard key={item.mbid} {...toTrackCardProps(item)} />
        ))}
        {isFetchingNextPage ? <MoreSkeletonCards /> : null}
      </div>
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
