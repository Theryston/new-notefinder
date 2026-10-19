import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import {
  applyFollowChange,
  followErrorCode,
  rollbackFollowChange,
  settleFollowChange,
} from './follow-changes';
import type { FollowCounts } from './follow-state';
import { profileKeys } from './query-keys';

const counts: FollowCounts = {
  followersCount: 3,
  followingCount: 1,
  friendsCount: 0,
};

const seeded = (following: boolean) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(profileKeys.counts('ada'), counts);
  queryClient.setQueryData(profileKeys.follow('ada'), {
    userId: 'grace-id',
    isFollowing: following,
  });
  return queryClient;
};

describe('applyFollowChange', () => {
  it('flips the follow state and the follower count before the request', async () => {
    const queryClient = seeded(false);

    await applyFollowChange(queryClient, 'ada', true);

    expect(queryClient.getQueryData(profileKeys.follow('ada'))).toEqual({
      userId: 'grace-id',
      isFollowing: true,
    });
    expect(queryClient.getQueryData(profileKeys.counts('ada'))).toEqual({
      ...counts,
      followersCount: 4,
    });
  });

  it('returns what it replaced, so a failure can put it back', async () => {
    const queryClient = seeded(true);

    const snapshot = await applyFollowChange(queryClient, 'ada', false);

    expect(snapshot).toEqual({
      follow: { userId: 'grace-id', isFollowing: true },
      counts,
    });
  });

  it('writes nothing for a Profile whose state was never read', async () => {
    const queryClient = new QueryClient();

    const snapshot = await applyFollowChange(queryClient, 'ada', true);

    expect(snapshot).toEqual({ follow: undefined, counts: undefined });
    expect(queryClient.getQueryData(profileKeys.follow('ada'))).toBeUndefined();
    expect(queryClient.getQueryData(profileKeys.counts('ada'))).toBeUndefined();
  });
});

describe('rollbackFollowChange', () => {
  it('puts the caches back as they were before the change', async () => {
    const queryClient = seeded(false);
    const snapshot = await applyFollowChange(queryClient, 'ada', true);

    rollbackFollowChange(queryClient, 'ada', snapshot);

    expect(queryClient.getQueryData(profileKeys.follow('ada'))).toEqual({
      userId: 'grace-id',
      isFollowing: false,
    });
    expect(queryClient.getQueryData(profileKeys.counts('ada'))).toEqual(counts);
  });

  it('does nothing without a snapshot', () => {
    const queryClient = seeded(true);

    rollbackFollowChange(queryClient, 'ada', undefined);

    expect(queryClient.getQueryData(profileKeys.follow('ada'))).toEqual({
      userId: 'grace-id',
      isFollowing: true,
    });
  });
});

describe('settleFollowChange', () => {
  it('marks both reads of the Profile as stale', async () => {
    const queryClient = seeded(false);

    await settleFollowChange(queryClient, 'ada');

    expect(
      queryClient.getQueryState(profileKeys.follow('ada'))?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(profileKeys.counts('ada'))?.isInvalidated,
    ).toBe(true);
  });
});

describe('followErrorCode', () => {
  it('uses the code of an API error, so the toast translates it', () => {
    const error = new ApiError({
      statusCode: 403,
      code: 'USERNAME_REQUIRED',
      message: 'Username is required',
    });

    expect(followErrorCode(error)).toBe('USERNAME_REQUIRED');
  });

  it('falls back to INTERNAL_ERROR for anything else', () => {
    expect(followErrorCode(new Error('connection refused'))).toBe(
      'INTERNAL_ERROR',
    );
  });
});
