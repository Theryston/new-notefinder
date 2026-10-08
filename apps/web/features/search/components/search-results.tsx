'use client';

import type { SearchResultItem, SearchScope } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { RequestTrackCard } from '@/features/tracks/components/request-track-card';
import { TrackCard } from '@/features/tracks/components/track-card';
import { TrackCardGrid } from '@/features/tracks/components/track-card-grid';
import { TrackCardMoreSkeletons } from '@/features/tracks/components/track-card-skeleton';

import { useSearchResults } from '../hooks/use-search-results';
import { signInToRequestHref } from '../request-sign-in';
import {
  offersSignInToRequest,
  offersTrackRequest,
} from '../search-result-action';
import { toTrackCardProps } from '../search-result-to-track-card';
import { SearchEmpty } from './search-empty';
import { SearchError } from './search-error';
import { SearchSkeleton } from './search-skeleton';

/**
 * The cards of the loaded hits. A Recording without a Track asks for its notes
 * on click: signed-in visitors request them, signed-out ones go to sign in
 * first and come back to `searchPath` with the request marker. Hits with a
 * Track stay plain links.
 */
function SearchResultCards({
  items,
  stale,
  loadingMore,
  searchPath,
}: {
  items: SearchResultItem[];
  stale: boolean;
  loadingMore: boolean;
  searchPath: string;
}) {
  return (
    <SessionUserBoundary
      render={(user) => (
        <TrackCardGrid stale={stale}>
          {items.map((item) => {
            const card = toTrackCardProps(item);
            if (offersTrackRequest(item, user)) {
              return (
                <RequestTrackCard
                  key={item.mbid}
                  recordingMbid={item.mbid}
                  {...card}
                />
              );
            }
            if (offersSignInToRequest(item, user)) {
              return (
                <TrackCard
                  key={item.mbid}
                  {...card}
                  signIn={{
                    href: signInToRequestHref(searchPath, item.mbid),
                  }}
                />
              );
            }
            return <TrackCard key={item.mbid} {...card} />;
          })}
          {loadingMore ? <TrackCardMoreSkeletons /> : null}
        </TrackCardGrid>
      )}
    />
  );
}

/**
 * The result grid for a searchable query: best-first cards, infinite
 * scroll over limit plus offset, with loading, empty and retry states.
 * `searchPath` is this search as the URL has it, for the sign-in round trip.
 */
export function SearchResults({
  query,
  scope,
  searchPath,
}: {
  query: string;
  scope: SearchScope;
  searchPath: string;
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
        searchPath={searchPath}
      />
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
