import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  profileCountsQueryOptions,
  profileFollowQueryOptions,
} from './follow-query';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

describe('the follow queries', () => {
  beforeEach(() => {
    mockBrowserApi.mockResolvedValue({
      userId: 'grace-id',
      isFollowing: true,
      followersCount: 3,
      followingCount: 1,
      friendsCount: 1,
    });
  });

  it('reads the viewer follow state of the Profile in its query function', async () => {
    const query = profileFollowQueryOptions('grace');

    await expect(query.queryFn?.({} as never)).resolves.toMatchObject({
      isFollowing: true,
    });
    expect(mockBrowserApi).toHaveBeenCalledWith('/users/grace/follow', {
      schema: expect.anything(),
    });
  });

  it('reads the counts of the Profile from the API in its query function', async () => {
    const query = profileCountsQueryOptions('grace', {
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
    });

    await expect(query.queryFn?.({} as never)).resolves.toEqual({
      followersCount: 3,
      followingCount: 1,
      friendsCount: 1,
    });
    expect(mockBrowserApi).toHaveBeenCalledWith('/users/grace', {
      schema: expect.anything(),
    });
  });
});
