import type { TrackContributor } from '@notefinder/contracts';

import { UserAvatar } from '@/features/auth/components/user-avatar';

/** A Contributor's Avatar, or their initials without one. */
export function ContributorAvatar({
  contributor,
  className,
}: {
  contributor: TrackContributor;
  className?: string;
}) {
  return (
    <UserAvatar
      user={{
        name: contributor.name,
        username: contributor.username,
        // The session type leaves a missing photo out rather than null.
        image: contributor.image ?? undefined,
      }}
      className={className}
    />
  );
}
