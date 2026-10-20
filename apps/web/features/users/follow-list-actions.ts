import type { FollowListSide } from './follow-list-query';

/**
 * What a row of a follow list offers. The message key of each action is the
 * same name (`publicProfile.followList.<action>`).
 */
export type FollowListRowAction = 'removeFollower' | 'unfollow';

/**
 * The action each row offers the viewer. Only the Profile's own User manages
 * its lists: they remove a follower from the followers list and unfollow from
 * the following and friends lists. Everyone else gets no action.
 */
export function followListRowAction(
  side: FollowListSide,
  viewerIsOwner: boolean,
): FollowListRowAction | null {
  if (!viewerIsOwner) return null;
  return side === 'followers' ? 'removeFollower' : 'unfollow';
}
