import type { PublicProfile } from '@notefinder/contracts';

/** The three follow numbers under a Profile banner. */
export type FollowCounts = Pick<
  PublicProfile,
  'followersCount' | 'followingCount' | 'friendsCount'
>;

/** The follow numbers of a banner, without the rest of the Profile. */
export function followCountsOf(profile: PublicProfile): FollowCounts {
  return {
    followersCount: profile.followersCount,
    followingCount: profile.followingCount,
    friendsCount: profile.friendsCount,
  };
}

/**
 * The button's classes per state. The banner is a solid orange block, so the
 * button brings its own contrast: a white pill with orange text to follow, and
 * an outlined white pill with white text once following (DESIGN.md "Featured
 * blocks"). A label without its own color would inherit the banner's white on
 * a white fill.
 */
export function followButtonClasses(following: boolean): string {
  return following
    ? 'border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10'
    : 'bg-background text-primary hover:bg-background/90';
}

/**
 * The followers shown right after a follow change, before the server answers:
 * a follow adds one and an unfollow removes one, and a change that leaves the
 * state as it was changes nothing.
 */
export function followersAfter(
  followers: number,
  wasFollowing: boolean,
  nowFollowing: boolean,
): number {
  if (wasFollowing === nowFollowing) return followers;
  return Math.max(0, followers + (nowFollowing ? 1 : -1));
}
