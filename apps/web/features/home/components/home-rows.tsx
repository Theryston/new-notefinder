'use client';

import type { Locale } from '@notefinder/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { HomeFeedPage } from '../feed-page';
import { homeRowsQueryOptions } from '../home-rows-query';
import {
  homeLayoutRegistry,
  isRegisteredLayout,
} from '../layouts/layout-registry';
import { CarouselRowSkeleton } from './home-feed-skeleton';

const SENTINEL_MARGIN = '600px';

/** Keeps the first occurrence of each row id, so React keys stay unique. */
const uniqueRows = (rows: HomeFeedPage['rows']) => [
  ...new Map(rows.map((row) => [row.id, row])).values(),
];

/**
 * The rows of the home, in feed order, with the next pages loaded as the
 * visitor scrolls. Each row renders through the layout registry; the first
 * row is the only one whose images load eagerly.
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
  } = useInfiniteQuery(homeRowsQueryOptions(locale, initialPage));
  const rows = uniqueRows(data.pages.flatMap((page) => page.rows)).filter(
    (row) => isRegisteredLayout(row.layout),
  );
  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  return (
    <div className="flex flex-col gap-12">
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
