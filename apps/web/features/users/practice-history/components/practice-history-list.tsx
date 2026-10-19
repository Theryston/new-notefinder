'use client';

import type { PracticeAttemptHistoryPage } from '@notefinder/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { practiceHistoryQueryOptions } from '../practice-history-query';
import { useBrowserTimeZone } from '../use-browser-time-zone';
import { PracticeHistoryDays } from './practice-history-days';

type PracticeHistoryListProps = {
  username: string;
  initialPage?: PracticeAttemptHistoryPage;
};

/**
 * The Profile's practice history: runs grouped by day in the viewer's time
 * zone, newest first, with "Show more" for each next page. The server's first
 * page is shown at once; a page that failed to render there is fetched here.
 */
export function PracticeHistoryList({
  username,
  initialPage,
}: PracticeHistoryListProps) {
  const t = useTranslations('profileHistory');
  const timeZone = useBrowserTimeZone();
  const query = useInfiniteQuery(
    practiceHistoryQueryOptions({ username, initialPage }),
  );

  if (query.isPending) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        {t('loading')}
      </p>
    );
  }
  if (query.error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm">{t('error')}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  const attempts = query.data.pages.flatMap((page) => page.items);
  if (attempts.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PracticeHistoryDays attempts={attempts} timeZone={timeZone} />
      {/* Offered once hydrated: a click before that would be lost. */}
      {query.hasNextPage && timeZone !== undefined ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {t('showMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
