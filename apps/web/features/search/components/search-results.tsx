'use client';

import type { SearchScope } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { TrackCard } from '@/features/tracks/components/track-card';

import { useSearchResults } from '../hooks/use-search-results';
import { SearchCardSkeleton } from './search-card-skeleton';
import { SearchEmpty } from './search-empty';
import { SearchError } from './search-error';
import { SearchSkeleton } from './search-skeleton';

/** Four more card blocks appended while the next page loads. */
function MoreSkeletonCards() {
  return (
    <>
      {['more-0', 'more-1', 'more-2', 'more-3'].map((key) => (
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <TrackCard key={item.mbid} result={item} />
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
