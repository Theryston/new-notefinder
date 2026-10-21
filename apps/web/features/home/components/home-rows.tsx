'use client';

import type { HomeFeedPage, Locale } from '@notefinder/contracts';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useHomeRows } from '../hooks/use-home-rows';
import {
  homeLayoutRegistry,
  isRegisteredLayout,
} from '../layouts/layout-registry';
import { visibleRows } from '../visible-rows';
import { CarouselRowSkeleton } from './home-feed-skeleton';

const SENTINEL_MARGIN = '600px';

// The tracker only observes row visibility and posts event batches: it
// renders nothing and runs on the client only, so it loads after the page
// to keep the home inside the bundle budget.
const HomeEventsTracker = dynamic(
  () =>
    import('../events/home-events-tracker').then(
      (module) => module.HomeEventsTracker,
    ),
  { ssr: false },
);

/**
 * The rows of the home, in feed order, with the next pages loaded as the
 * visitor scrolls. Each row renders through the layout registry; the first
 * visible row is the only one whose images load eagerly.
 */
export function HomeRows({
  locale,
  initialPage,
}: {
  locale: Locale;
  initialPage: HomeFeedPage;
}) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useHomeRows(locale, initialPage);
  const rows = visibleRows(
    data.pages.flatMap((page) => page.rows),
    isRegisteredLayout,
  );
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  return (
    <div className="flex flex-col gap-12">
      <HomeEventsTracker pages={data.pages} />
      {rows.map((row, index) => (
        <Fragment key={row.id}>
          {homeLayoutRegistry[row.layout].render(row, index === 0)}
        </Fragment>
      ))}
      {isFetchingNextPage ? <CarouselRowSkeleton /> : null}
      {isFetchNextPageError ? <LoadMoreError onRetry={loadMore} /> : null}
      {hasNextPage && !isFetchNextPageError ? (
        <LoadMoreSentinel active={!isFetchingNextPage} onVisible={loadMore} />
      ) : null}
    </div>
  );
}

/** Fires once the marker nears the viewport, so the next rows load ahead of the scroll. */
function LoadMoreSentinel({
  active,
  onVisible,
}: {
  active: boolean;
  onVisible: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const marker = ref.current;
    if (!marker || !active) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onVisible();
      },
      { rootMargin: SENTINEL_MARGIN },
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [active, onVisible]);

  return <div ref={ref} aria-hidden="true" className="h-px" />;
}

function LoadMoreError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('home.feed');
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-sm">{t('loadMoreError')}</p>
      <Button type="button" variant="outline" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}
