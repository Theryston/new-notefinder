'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import type { TrackCollection } from '../track-collection';
import { trackPagesOptions } from '../track-pages';
import { TrackGridSkeleton } from './track-card-skeleton';
import { TrackGrid } from './track-grid';

// Start loading the next page this far before the button scrolls into view.
// Small enough that a desktop screen doesn't reach it on arrival: most
// visitors never scroll, and would pay for the fetch and its code.
const PRELOAD_MARGIN = '400px';
// One row of the widest layout while a page loads.
const LOADING_CARDS = 6;

type MoreTracksProps = {
  collection: TrackCollection;
  /** `nextCursor` of the server-rendered first page. */
  cursor: string;
};

/**
 * The pages after the first one (infinite scroll). A visible button stays
 * as the trigger for keyboards and for browsers that don't report
 * scrolling; nearing it on screen presses it.
 */
export function MoreTracks({ collection, cursor }: MoreTracksProps) {
  const t = useTranslations('tracks.list');
  const [started, setStarted] = useState(false);
  const query = useInfiniteQuery(
    trackPagesOptions(collection, cursor, started),
  );
  const tracks = query.data?.pages.flatMap((page) => page.items) ?? [];
  const hasMore = !started || query.hasNextPage;
  const loading = started && query.isFetching;

  const loadMore = () => {
    if (!started) setStarted(true);
    else if (query.hasNextPage && !query.isFetching) {
      void query.fetchNextPage();
    }
  };
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  // The button is hidden while a page loads, so each new one is observed
  // afresh: if a short page left it near the viewport, it fires again.
  const observeTrigger = useCallback((trigger: HTMLButtonElement | null) => {
    if (!trigger || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {tracks.length > 0 && <TrackGrid tracks={tracks} />}
      {loading && (
        <div role="status" aria-label={t('loading')}>
          <TrackGridSkeleton count={LOADING_CARDS} />
        </div>
      )}
      {query.isError && !loading && (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-muted-foreground text-sm">{t('error')}</p>
          <Button
            variant="secondary"
            // Without a page yet, the failed fetch was the first one.
            onClick={() =>
              void (query.data ? query.fetchNextPage() : query.refetch())
            }
          >
            {t('retry')}
          </Button>
        </div>
      )}
      {hasMore && !loading && !query.isError && (
        <Button
          ref={observeTrigger}
          variant="secondary"
          className="self-center"
          onClick={loadMore}
        >
          {t('loadMore')}
        </Button>
      )}
    </>
  );
}
