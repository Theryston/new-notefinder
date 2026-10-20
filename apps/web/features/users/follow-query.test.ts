import {
  profileFollowSchema,
  publicProfileSchema,
} from '@notefinder/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  fetchProfileCounts,
  fetchProfileFollow,
  profileCountsQueryOptions,
  profileFollowQueryOptions,
  setFollow,
} from './follow-query';
import { profileKeys } from './query-keys';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

describe('setFollow', () => {
  beforeEach(() => {
    mockBrowserApi.mockResolvedValue(undefined);
  });

  it('follows the User by ID with PUT', async () => {
    await setFollow('user-1', true);

    expect(mockBrowserApi).toHaveBeenCalledWith('/me/following/user-1', {
      method: 'PUT',
      schema: expect.anything(),
    });
  });

  it('stops following with DELETE, encoding the ID', async () => {
    await setFollow('user 1/x', false);

    expect(mockBrowserApi).toHaveBeenCalledWith('/me/following/user%201%2Fx', {
      method: 'DELETE',
      schema: expect.anything(),
    });
  });
});

describe('fetchProfileFollow', () => {
  it('reads the follow state of the viewer with the follow schema', async () => {
    mockBrowserApi.mockResolvedValueOnce({ userId: 'u', isFollowing: false });

    await expect(fetchProfileFollow('ada_lovelace')).resolves.toEqual({
      userId: 'u',
      isFollowing: false,
    });
    expect(mockBrowserApi).toHaveBeenCalledWith('/users/ada_lovelace/follow', {
      schema: profileFollowSchema,
    });
  });

  it('is the query of the Profile follow key', () => {
    expect(profileFollowQueryOptions('ada_lovelace').queryKey).toEqual(
      profileKeys.follow('ada_lovelace'),
    );
  });
});

describe('profileCountsQueryOptions', () => {
  const initial = { followersCount: 3, followingCount: 2, friendsCount: 1 };

  it('starts from the counts the server rendered, and is kept until a change', () => {
    const options = profileCountsQueryOptions('ada', initial);

    expect(options.queryKey).toEqual(profileKeys.counts('ada'));
    expect(options.initialData).toEqual(initial);
    expect(options.staleTime).toBe(Number.POSITIVE_INFINITY);
    expect(options.gcTime).toBe(0);
  });
});

describe('fetchProfileCounts', () => {
  it('reads the Profile from the API and keeps the three counts', async () => {
    mockBrowserApi.mockResolvedValueOnce({
      username: 'ada',
      name: 'Ada',
      image: null,
      createdAt: '2026-01-02T03:04:05.000Z',
      dailyPracticeTargetSeconds: null,
      vocalRange: null,
      mostSungArtist: null,
      followersCount: 4,
      followingCount: 2,
      friendsCount: 1,
    });

    await expect(fetchProfileCounts('ada')).resolves.toEqual({
      followersCount: 4,
      followingCount: 2,
      friendsCount: 1,
    });
    expect(mockBrowserApi).toHaveBeenCalledWith('/users/ada', {
      schema: publicProfileSchema,
    });
  });
});
