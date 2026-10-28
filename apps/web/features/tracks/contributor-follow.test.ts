import type { InfiniteData } from '@tanstack/react-query';
import type {
  TrackContributorEntry,
  TrackContributorsPage,
} from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';

import {
  contributorFollowOf,
  withContributorFollow,
} from './contributor-follow';

const ada: TrackContributorEntry = {
  id: 'contributor-ada',
  userId: 'user-ada',
  username: 'ada',
  name: 'Ada Lovelace',
  image: null,
  isFollowing: false,
};

const signedIn = { username: 'viewer' };

describe('contributorFollowOf', () => {
  it('offers the follow state of another Contributor to a signed-in viewer', () => {
    expect(contributorFollowOf(ada, signedIn)).toEqual({
      userId: 'user-ada',
      following: false,
    });
  });

  it('reports a Contributor the viewer already follows', () => {
    expect(
      contributorFollowOf({ ...ada, isFollowing: true }, signedIn),
    ).toEqual({ userId: 'user-ada', following: true });
  });

  it('offers no button to an anonymous viewer', () => {
    expect(contributorFollowOf(ada, null)).toBeNull();
  });

  it('offers no button when the flag is absent, as for an anonymous read', () => {
    const { isFollowing: _omitted, ...withoutFlag } = ada;
    expect(contributorFollowOf(withoutFlag, signedIn)).toBeNull();
  });

  it('offers no button for the viewer’s own row', () => {
    expect(
      contributorFollowOf({ ...ada, username: 'viewer' }, signedIn),
    ).toBeNull();
  });

  it('offers no button for a Contributor without a Username', () => {
    expect(
      contributorFollowOf({ ...ada, username: null }, signedIn),
    ).toBeNull();
  });

  it('offers no button to a viewer without a Username of their own', () => {
    expect(contributorFollowOf(ada, { username: null })).toBeNull();
  });

  it('offers no button when the User ID is missing', () => {
    const { userId: _omitted, ...withoutId } = ada;
    expect(contributorFollowOf(withoutId, signedIn)).toBeNull();
  });
});

describe('withContributorFollow', () => {
  const page = (items: TrackContributorEntry[]): TrackContributorsPage => ({
    items,
    nextCursor: null,
    total: items.length,
  });

  const grace: TrackContributorEntry = {
    ...ada,
    id: 'contributor-grace',
    userId: 'user-grace',
    username: 'grace',
    name: 'Grace Hopper',
  };

  const data: InfiniteData<TrackContributorsPage> = {
    pages: [page([ada]), page([grace])],
    pageParams: [undefined, 'next'],
  };

  it('sets the follow flag of the named User on every page', () => {
    const next = withContributorFollow(data, 'user-grace', true);

    expect(
      next?.pages.map((p) => p.items.map((item) => item.isFollowing)),
    ).toEqual([[false], [true]]);
  });

  it('leaves the other Contributors and the paging as they were', () => {
    const next = withContributorFollow(data, 'user-grace', true);

    expect(next?.pageParams).toEqual([undefined, 'next']);
    expect(next?.pages[0]?.items[0]).toEqual(ada);
    expect(next?.pages[1]?.items[0]).toEqual({ ...grace, isFollowing: true });
  });

  it('passes an empty cache through', () => {
    expect(
      withContributorFollow(undefined, 'user-grace', true),
    ).toBeUndefined();
  });
});
