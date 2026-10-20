import { describe, expect, it } from 'vitest';

import { followListRowAction } from './follow-list-actions';

describe('followListRowAction', () => {
  it('offers the owner Remove follower on the followers list', () => {
    expect(followListRowAction('followers', true)).toBe('removeFollower');
  });

  it('offers the owner Unfollow on the following and friends lists', () => {
    expect(followListRowAction('following', true)).toBe('unfollow');
    expect(followListRowAction('friends', true)).toBe('unfollow');
  });

  it('offers no action to a visitor, whichever list is open', () => {
    for (const side of ['followers', 'following', 'friends'] as const) {
      expect(followListRowAction(side, false)).toBeNull();
    }
  });
});
