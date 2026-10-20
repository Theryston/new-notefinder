'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { profileFollowQueryOptions } from '../follow-query';
import { followButtonClasses } from '../follow-state';
import { useProfileFollow } from '../hooks/use-profile-follow';

/**
 * The follow button of a Profile, in the banner's action row. Only a
 * signed-in visitor who is not the owner gets it; while the session loads it
 * holds the button's footprint, so the row does not move when it appears.
 */
export function ProfileFollowButton({ username }: { username: string }) {
  return (
    <SessionUserBoundary
      render={(user, loading) => {
        if (loading) {
          return <span aria-hidden="true" className="h-10 w-32" />;
        }
        if (!user || user.username === username) {
          return null;
        }
        return <FollowButton username={username} />;
      }}
    />
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
      variant="default"
      className={followButtonClasses()}
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
