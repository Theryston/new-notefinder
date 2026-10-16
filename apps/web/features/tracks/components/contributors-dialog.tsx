'use client';

import type { TrackContributor } from '@notefinder/contracts';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link } from '@/lib/i18n/navigation';

import { useContributors } from '../hooks/use-contributors';
import { ContributorAvatar } from './contributor-avatar';

const SEARCH_DEBOUNCE_MS = 300;
const AVATAR_CLASS = 'size-12';

/** One Contributor: Avatar, name and handle, linking to their Profile. */
function ContributorRow({ contributor }: { contributor: TrackContributor }) {
  const tp = useTranslations('tracks.practice');
  const body = (
    <>
      <ContributorAvatar contributor={contributor} className={AVATAR_CLASS} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-sm">
          {contributor.name}
        </span>
        {contributor.username === null ? null : (
          <span className="truncate text-muted-foreground text-xs">
            @{contributor.username}
          </span>
        )}
      </span>
    </>
  );
  const className =
    'flex min-h-14 items-center gap-3 rounded-2xl px-2 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50';
  return (
    <li>
      {contributor.username === null ? (
        <div className={className}>{body}</div>
      ) : (
        <Link
          href={`/users/${contributor.username}`}
          aria-label={tp('contributorLink', { name: contributor.name })}
          className={`${className} hover:bg-accent`}
        >
          {body}
        </Link>
      )}
    </li>
  );
}

/** Pill search field following the DESIGN.md input group. */
function ContributorsSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('tracks.practice.contributorsDialog');
  return (
    <label className="flex h-10 items-center gap-2 rounded-full bg-muted px-4">
      <SearchIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('search')}
        aria-label={t('search')}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

/** Infinite Contributor rows with search, status and retry. */
function ContributorsList({ trackId }: { trackId: string }) {
  const t = useTranslations('tracks.practice.contributorsDialog');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useContributors(trackId, query);

  useEffect(() => {
    const target = sentinel.current;
    if (target === null || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const items = (data?.pages ?? []).flatMap((page) => page.items);
  const total = data?.pages[0]?.total ?? 0;
  const shown = items.length;

  return (
    <>
      <ContributorsSearch value={input} onChange={setInput} />
      {error ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <p role="alert" className="text-muted-foreground text-sm">
            {t('loadError')}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="h-10 rounded-full bg-secondary px-4 font-semibold text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t('retry')}
          </button>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-xs tabular-nums">
            {t('showing', { shown, total })}
          </p>
          {items.length === 0 && !isFetchingNextPage ? (
            <p className="py-6 text-center text-muted-foreground text-sm">
              {t('empty', { query })}
            </p>
          ) : (
            <ul className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {items.map((item) => (
                <ContributorRow key={item.id} contributor={item} />
              ))}
            </ul>
          )}
          <div ref={sentinel} aria-hidden="true" className="h-px shrink-0" />
          {isFetchingNextPage ? (
            <p
              role="status"
              className="text-center text-muted-foreground text-sm"
            >
              {t('loadingMore')}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

/** Every Contributor of the Track: search plus infinite scroll. */
export function ContributorsDialog({
  trackId,
  open,
  onOpenChange,
}: {
  trackId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('tracks.practice.contributorsDialog');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('close')} className="max-h-[80dvh]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <ContributorsList trackId={trackId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
