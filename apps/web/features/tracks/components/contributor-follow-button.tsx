'use client';

import type { TrackContributorEntry } from '@vozzify/contracts';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';

import { contributorFollowOf } from '../contributor-follow';
import { useContributorFollow } from '../hooks/use-contributor-follow';

/**
 * The follow button of one Contributor's row, for a signed-in viewer only (see
 * `contributorFollowOf`). The button is disabled while its request runs, and a
 * failed request says so under it.
 */
export function ContributorFollowButton({
  trackId,
  contributor,
}: {
  trackId: string;
  contributor: TrackContributorEntry;
}) {
  return (
    <SessionUserBoundary
      render={(viewer) => {
        const follow = contributorFollowOf(contributor, viewer);
        if (follow === null) return null;
        return (
          <FollowToggle
            trackId={trackId}
            name={contributor.name}
            userId={follow.userId}
            following={follow.following}
          />
        );
      }}
    />
  );
}

function FollowToggle({
  trackId,
  name,
  userId,
  following,
}: {
  trackId: string;
  name: string;
  userId: string;
  following: boolean;
}) {
  const t = useTranslations('tracks.practice.contributorsDialog');
  const change = useContributorFollow(trackId);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={following ? 'outline' : 'default'}
        disabled={change.isPending}
        aria-label={
          following ? t('unfollowLabel', { name }) : t('followLabel', { name })
        }
        onClick={() => change.mutate({ userId, follow: !following })}
      >
        {following ? t('unfollow') : t('follow')}
      </Button>
      {change.isError ? (
        <span
          role="alert"
          className="max-w-40 text-right text-destructive text-xs"
        >
          {t('followError')}
        </span>
      ) : null}
    </div>
  );
}
