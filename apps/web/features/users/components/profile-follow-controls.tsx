'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { FollowListSide } from '../follow-list-query';
import { profileCountsQueryOptions } from '../follow-query';
import type { FollowCounts } from '../follow-state';
import { FollowListDialog } from './follow-list-dialog';

/** The follow counts of a Profile, each one opening its list. */
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
    <>
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
    </>
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
