import type { FollowListPage } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import {
  FOLLOW_LIST_PAGE_LIMIT,
  followListPath,
  nextFollowListPageParam,
} from './follow-list-query';

const page = (nextCursor: string | null): FollowListPage => ({
  items: [],
  nextCursor,
});

describe('followListPath', () => {
  it('addresses each list of a Profile under its username', () => {
    expect(followListPath('ada_lovelace', 'followers')).toBe(
      '/users/ada_lovelace/followers',
    );
    expect(followListPath('ada_lovelace', 'following')).toBe(
      '/users/ada_lovelace/following',
    );
    expect(followListPath('ada_lovelace', 'friends')).toBe(
      '/users/ada_lovelace/friends',
    );
  });

  it('encodes a username that is not a plain path segment', () => {
    expect(followListPath('a/b', 'followers')).toBe('/users/a%2Fb/followers');
  });
});

describe('nextFollowListPageParam', () => {
  it('asks for the page after the cursor the last page ended with', () => {
    expect(nextFollowListPageParam(page('cursor-2'))).toBe('cursor-2');
  });

  it('stops when the last page has no next cursor', () => {
    expect(nextFollowListPageParam(page(null))).toBeUndefined();
  });
});

describe('FOLLOW_LIST_PAGE_LIMIT', () => {
  it('matches the 20 items per page the API serves by default', () => {
    expect(FOLLOW_LIST_PAGE_LIMIT).toBe(20);
  });
});
