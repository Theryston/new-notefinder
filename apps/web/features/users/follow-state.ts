import type { PublicProfile } from '@vozzify/contracts';

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
 * The button's classes, the same whether the viewer follows or not. The banner
 * is a solid orange block, so the button brings its own contrast: a white pill
 * with orange text (DESIGN.md "Featured blocks"). A label without its own color
 * would inherit the banner's white on a white fill.
 */
export function followButtonClasses(): string {
  return 'bg-primary-foreground text-primary hover:bg-primary-foreground/90';
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
