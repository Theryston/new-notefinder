'use client';

import type { FollowListUser } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { type RefObject, useEffect, useRef } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/features/auth/components/user-avatar';
import { Link } from '@/lib/i18n/navigation';

import type { FollowListSide } from '../follow-list-query';
import { useFollowList } from '../hooks/use-follow-list';

const EMPTY_KEY = {
  followers: 'emptyFollowers',
  following: 'emptyFollowing',
  friends: 'emptyFriends',
} as const;

const AVATAR_CLASS = 'size-12';
const ROW_CLASS =
  'flex min-h-14 items-center gap-3 rounded-2xl px-2 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * A Profile's followers, following or friends in a dialog: read-only rows that
 * link to each User's Profile, with infinite scroll. Mounted only while it is
 * open, so each opening starts its list from the first page (or the cache).
 */
export function FollowListDialog({
  username,
  side,
  open,
  onOpenChange,
}: {
  username: string;
  side: FollowListSide;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('publicProfile.followList');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('close')}
        className="max-h-[80dvh] overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>{t(side)}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {open ? <FollowListBody username={username} side={side} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FollowListBody({
  username,
  side,
}: {
  username: string;
  side: FollowListSide;
}) {
  const t = useTranslations('publicProfile.followList');
  const list = useRef<HTMLUListElement>(null);
  const sentinel = useRef<HTMLLIElement>(null);
  const result = useFollowList(username, side);
  useLoadNextOnScroll(result, list, sentinel);

  if (result.error) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <p role="alert" className="text-muted-foreground text-sm">
          {t('loadError')}
        </p>
        <button
          type="button"
          onClick={() => void result.refetch()}
          className="h-10 rounded-full bg-secondary px-4 font-semibold text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (result.isPending) {
    return (
      <p
        role="status"
        className="py-6 text-center text-muted-foreground text-sm"
      >
        {t('loading')}
      </p>
    );
  }

  const items = result.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground text-sm">
        {t(EMPTY_KEY[side])}
      </p>
    );
  }

  return (
    <>
      <ul
        ref={list}
        className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        {items.map((user) => (
          <FollowListRow key={user.id} user={user} />
        ))}
        {result.hasNextPage ? (
          <li ref={sentinel} aria-hidden="true" className="h-px shrink-0" />
        ) : null}
      </ul>
      {result.isFetchingNextPage ? (
        <p role="status" className="text-center text-muted-foreground text-sm">
          {t('loadingMore')}
        </p>
      ) : null}
    </>
  );
}

/**
 * Fetches the next page when the sentinel after the last row scrolls into the
 * list's visible area, so the list grows as the user reaches its end.
 */
function useLoadNextOnScroll(
  result: ReturnType<typeof useFollowList>,
  list: RefObject<HTMLUListElement | null>,
  sentinel: RefObject<HTMLLIElement | null>,
) {
  const { error, fetchNextPage, hasNextPage, isFetchingNextPage } = result;
  useEffect(() => {
    const target = sentinel.current;
    const root = list.current;
    if (error || target === null || root === null || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: '100px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [error, fetchNextPage, hasNextPage, isFetchingNextPage, list, sentinel]);
}

/**
 * One listed User: Avatar, name and handle, linking to their Profile. A User
 * without a username has no Profile to open, so the row is not a link.
 */
function FollowListRow({ user }: { user: FollowListUser }) {
  const body = (
    <>
      <UserAvatar
        user={{
          name: user.name,
          username: user.username,
          image: user.image ?? undefined,
        }}
        className={AVATAR_CLASS}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-sm">{user.name}</span>
        {user.username === null ? null : (
          <span className="truncate text-muted-foreground text-xs">
            @{user.username}
          </span>
        )}
      </span>
    </>
  );
  return (
    <li>
      {user.username === null ? (
        <div className={ROW_CLASS}>{body}</div>
      ) : (
        <Link
          href={`/users/${user.username}`}
          className={`${ROW_CLASS} hover:bg-accent`}
        >
          {body}
        </Link>
      )}
    </li>
  );
}
