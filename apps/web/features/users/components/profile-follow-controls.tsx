'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import type { FollowListSide } from '../follow-list-query';
import {
  profileCountsQueryOptions,
  profileFollowQueryOptions,
} from '../follow-query';
import { type FollowCounts, followButtonClasses } from '../follow-state';
import { useProfileFollow } from '../hooks/use-profile-follow';
import { FollowListDialog } from './follow-list-dialog';

/**
 * The follow counts of a Profile and, for a signed-in visitor who is not the
 * owner, the follow button. Visitors see the counts alone.
 */
export function ProfileFollowControls({
  username,
  counts,
}: {
  username: string;
  counts: FollowCounts;
}) {
  const t = useTranslations('publicProfile.follow');
  const { data: shown } = useQuery(profileCountsQueryOptions(username, counts));
  const [list, setList] = useState<FollowListSide>('followers');
  const [listOpen, setListOpen] = useState(false);
  const openList = (side: FollowListSide) => {
    setList(side);
    setListOpen(true);
  };

  return (
    // The button's height is held for every viewer, so the banner does not
    // move when a visitor's session turns out to have no button.
    <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
      <ul aria-label={t('label')} className="flex flex-wrap gap-x-5 gap-y-1">
        <li>
          <CountButton onClick={() => openList('followers')}>
            {t('followers', { count: shown.followersCount })}
          </CountButton>
        </li>
        <li>
          <CountButton onClick={() => openList('following')}>
            {t('following', { count: shown.followingCount })}
          </CountButton>
        </li>
        <li>
          <CountButton onClick={() => openList('friends')}>
            {t('friends', { count: shown.friendsCount })}
          </CountButton>
        </li>
      </ul>
      <SessionUserBoundary
        render={(user, loading) => (
          <FollowListDialog
            username={username}
            side={list}
            open={listOpen}
            // The lists' actions are the owner's alone; a visitor or a loading
            // session gets none.
            viewerIsOwner={!loading && user?.username === username}
            onOpenChange={setListOpen}
          />
        )}
      />
      <SessionUserBoundary
        render={(user, loading) => {
          // Holds the button's footprint while the session loads.
          if (loading) {
            return <span aria-hidden="true" className="h-10 w-32" />;
          }
          if (!user || user.username === username) {
            return null;
          }
          return <FollowButton username={username} />;
        }}
      />
    </div>
  );
}

/** A follow count that opens its list. Its color is inherited from the banner. */
function CountButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md text-left underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}

function FollowButton({ username }: { username: string }) {
  const t = useTranslations('publicProfile.follow');
  const follow = useQuery(profileFollowQueryOptions(username));
  const change = useProfileFollow(username);
  const state = follow.data;
  const following = state?.isFollowing ?? false;

  return (
    <Button
      type="button"
      variant={following ? 'outline' : 'default'}
      className={followButtonClasses(following)}
      disabled={state === undefined || change.isPending}
      onClick={() => {
        if (state) {
          change.mutate({ userId: state.userId, follow: !following });
        }
      }}
    >
      {following ? t('unfollow') : t('follow')}
    </Button>
  );
}
