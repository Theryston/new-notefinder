'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';

import {
  profileCountsQueryOptions,
  profileFollowQueryOptions,
} from '../follow-query';
import type { FollowCounts } from '../follow-state';
import { useProfileFollow } from '../hooks/use-profile-follow';

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

  return (
    // The button's height is held for every viewer, so the banner does not
    // move when a visitor's session turns out to have no button.
    <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
      <ul aria-label={t('label')} className="flex flex-wrap gap-x-5 gap-y-1">
        <li>{t('followers', { count: shown.followersCount })}</li>
        <li>{t('following', { count: shown.followingCount })}</li>
        <li>{t('friends', { count: shown.friendsCount })}</li>
      </ul>
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
