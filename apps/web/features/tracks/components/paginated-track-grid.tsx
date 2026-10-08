'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

import { Button } from '@/components/ui/button';
import type { CursorPagesQuery } from '@/lib/cursor-pages-query';

import { groupTracksByHeading, type TrackGroup } from '../track-groups';
import { TrackCard, type TrackCardProps } from './track-card';
import { TrackCardGrid } from './track-card-grid';
import { TrackCardMoreSkeletons } from './track-card-skeleton';
import {
  TrackGridEmpty,
  TrackGridError,
  TrackGridSkeleton,
} from './track-grid-feedback';
import type { TrackGridMessages } from './track-grid-messages';

/** Anything the grid can list: every item carries the id it is keyed by. */
type GridItem = { id: string };

type TrackGridBodyProps<TItem extends GridItem> = {
  messages: TrackGridMessages;
  /** The list's query key, page fetcher and server-rendered first page. */
  query: CursorPagesQuery<TItem>;
  toCardProps: (item: TItem) => TrackCardProps;
  groupBy?: (item: TItem) => string | null;
};

type PaginatedTrackGridProps<TItem extends GridItem> =
  TrackGridBodyProps<TItem> & {
    /** Id of the section heading, which the section is labelled by. */
    headingId: string;
  };

/**
 * The paginated cover grid behind every track list (artist, album). It
 * keeps the server-rendered first page, paginates in place (infinite scroll
 * plus an explicit button) and owns the loading, error and empty states.
 * With `groupBy`, a heading opens each group of items, shown only when the
 * loaded items span more than one group. Callers supply the query, so the
 * grid never knows which entity it lists.
 */
export function PaginatedTrackGrid<TItem extends GridItem>({
  headingId,
  ...body
}: PaginatedTrackGridProps<TItem>) {
  return (
    <TracksSection headingId={headingId} title={body.messages.title}>
      <TrackGridBody {...body} />
    </TracksSection>
  );
}

/**
 * The section frame: the heading stays mounted through loading, error and
 * empty states, so assistive tech keeps the context whatever the grid is
 * doing.
 */
function TracksSection({
  headingId,
  title,
  children,
}: {
  headingId: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="font-bold text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TrackGridBody<TItem extends GridItem>({
  messages,
  query,
  toCardProps,
  groupBy,
}: TrackGridBodyProps<TItem>) {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useInfiniteQuery(query);
  // Paging is only offered once the whole grid has hydrated. A next page that
  // lands earlier makes React discard the server-rendered cards and render
  // them again, which replaces nodes a reader or a test is already using.
  const ready = useMounted();

  if (isPending) return <TrackGridSkeleton label={messages.loading} />;
  if (error) {
    return (
      <TrackGridError
        messages={messages.error}
        onRetry={() => void refetch()}
      />
    );
  }

  const items = data.pages.flatMap((page) => page.items);
  if (items.length === 0) return <TrackGridEmpty messages={messages.empty} />;

  return (
    <>
      <TrackGroups
        groups={groupTracksByHeading(items, groupBy)}
        toCardProps={toCardProps}
        loadingMore={isFetchingNextPage}
      />
      <TracksGridMore
        messages={messages}
        ready={ready}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
      />
    </>
  );
}

/**
 * One cover grid per group, each under its heading when there is one. The
 * placeholders for a page in flight close the last group.
 */
function TrackGroups<TItem extends GridItem>({
  groups,
  toCardProps,
  loadingMore,
}: {
  groups: TrackGroup<TItem>[];
  toCardProps: (item: TItem) => TrackCardProps;
  loadingMore: boolean;
}) {
  return (
    <>
      {groups.map((group, index) => (
        <Fragment key={group.items[0]?.id}>
          {group.heading ? (
            <h3 className="font-semibold text-lg">{group.heading}</h3>
          ) : null}
          <TrackCardGrid>
            {group.items.map((item) => (
              <TrackCard key={item.id} {...toCardProps(item)} />
            ))}
            {loadingMore && index === groups.length - 1 ? (
              <TrackCardMoreSkeletons />
            ) : null}
          </TrackCardGrid>
        </Fragment>
      ))}
    </>
  );
}

/**
 * Pagination controls below the grid: an infinite-scroll sentinel plus
 * an explicit button, with a status line while the next page loads.
 */
function TracksGridMore({
  messages,
  ready,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  messages: Pick<TrackGridMessages, 'loadingMore' | 'loadMore'>;
  /** Whether the grid has hydrated, so paging may start. */
  ready: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // The server renders the button, but its click handler only exists once the
  // client has hydrated. Until then the button is disabled, so it reads as
  // unavailable rather than silently ignoring a press; clients (and Playwright's
  // actionability checks) wait for it to enable.
  const unavailable = !ready || isFetchingNextPage;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !ready || !hasNextPage) return;
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
  }, [ready, hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {isFetchingNextPage ? (
        <p role="status" className="text-center text-muted-foreground text-sm">
          {messages.loadingMore}
        </p>
      ) : null}
      {hasNextPage ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onLoadMore}
          disabled={unavailable}
          aria-disabled={unavailable}
          className="mx-auto"
        >
          {messages.loadMore}
        </Button>
      ) : null}
    </>
  );
}

const noSubscription = () => () => {};

/**
 * False while rendering on the server and during hydration, true from the
 * first client render after it. Reads without an effect, so the first paint
 * already matches the server HTML.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
