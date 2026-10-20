import type { ApiErrorCode, FollowListPage } from '@notefinder/contracts';
import { type InfiniteData, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  type FollowListActionOptions,
  followListActionMutation,
  followListKeys,
  removeFromFollowList,
  restoreFollowList,
  sendFollowListAction,
  settleFollowListAction,
  withoutListUser,
} from './follow-list-changes';
import { profileKeys } from './query-keys';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

const user = (id: string) => ({
  id,
  username: id,
  name: id,
  image: null,
});

const pages = (...pageItems: string[][]): InfiniteData<FollowListPage> => ({
  pageParams: pageItems.map((_, index) => (index === 0 ? undefined : 'next')),
  pages: pageItems.map((ids, index) => ({
    items: ids.map(user),
    nextCursor: index < pageItems.length - 1 ? 'next' : null,
  })),
});

const idsOf = (data: InfiniteData<FollowListPage> | undefined) =>
  data?.pages.map((page) => page.items.map((item) => item.id));

describe('withoutListUser', () => {
  it('takes the User out of whichever loaded page holds them', () => {
    const result = withoutListUser(pages(['a', 'b'], ['c', 'd']), 'c');

    expect(idsOf(result)).toEqual([['a', 'b'], ['d']]);
  });

  it('keeps the cursors and page params, so the next page still loads', () => {
    const result = withoutListUser(pages(['a', 'b'], ['c']), 'a');

    expect(result?.pageParams).toEqual([undefined, 'next']);
    expect(result?.pages.map((page) => page.nextCursor)).toEqual([
      'next',
      null,
    ]);
  });

  it('changes nothing when the User is not in the list', () => {
    const result = withoutListUser(pages(['a'], ['b']), 'z');

    expect(idsOf(result)).toEqual([['a'], ['b']]);
  });

  it('answers undefined when nothing is cached', () => {
    expect(withoutListUser(undefined, 'a')).toBeUndefined();
  });
});

describe('sendFollowListAction', () => {
  beforeEach(() => {
    mockBrowserApi.mockResolvedValue(undefined);
  });

  it('removes a follower with DELETE on the viewer followers, encoding the ID', async () => {
    await sendFollowListAction({
      userId: 'fan 1/x',
      action: 'removeFollower',
    });

    expect(mockBrowserApi).toHaveBeenCalledWith('/me/followers/fan%201%2Fx', {
      method: 'DELETE',
      schema: expect.anything(),
    });
  });

  it('unfollows a User from a list with DELETE on the viewer follows', async () => {
    await sendFollowListAction({
      userId: 'idol-1',
      action: 'unfollow',
    });

    expect(mockBrowserApi).toHaveBeenCalledWith('/me/following/idol-1', {
      method: 'DELETE',
      schema: expect.anything(),
    });
  });
});

describe('removing a row from a cached follow list', () => {
  const key = profileKeys.followList('ada_lovelace', 'followers');

  it('takes the row out at once and answers what the list held before', async () => {
    const queryClient = new QueryClient();
    const before = pages(['a', 'b'], ['c']);
    queryClient.setQueryData(key, before);

    const previous = await removeFromFollowList(
      queryClient,
      'ada_lovelace',
      'followers',
      'b',
    );

    expect(idsOf(queryClient.getQueryData(key))).toEqual([['a'], ['c']]);
    expect(idsOf(previous)).toEqual([['a', 'b'], ['c']]);
  });

  it('puts the list back as it was when the request fails', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, pages(['a', 'b']));
    const previous = await removeFromFollowList(
      queryClient,
      'ada_lovelace',
      'followers',
      'a',
    );

    restoreFollowList(queryClient, 'ada_lovelace', 'followers', previous);

    expect(idsOf(queryClient.getQueryData(key))).toEqual([['a', 'b']]);
  });

  it('leaves an uncached list uncached', async () => {
    const queryClient = new QueryClient();

    const previous = await removeFromFollowList(
      queryClient,
      'ada_lovelace',
      'following',
      'a',
    );

    expect(previous).toBeUndefined();
    expect(
      queryClient.getQueryData(
        profileKeys.followList('ada_lovelace', 'following'),
      ),
    ).toBeUndefined();
  });
});

describe('settleFollowListAction', () => {
  it('reads the counts and all three lists of the Profile again', async () => {
    const queryClient = new QueryClient();
    const keys = followListKeys('ada_lovelace');
    for (const queryKey of keys) {
      queryClient.setQueryData(queryKey, {});
    }

    await settleFollowListAction(queryClient, 'ada_lovelace');

    expect(keys).toHaveLength(4);
    for (const queryKey of keys) {
      expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });

  it('leaves the lists of other Profiles alone', async () => {
    const queryClient = new QueryClient();
    const other = profileKeys.followList('grace', 'followers');
    queryClient.setQueryData(other, {});

    await settleFollowListAction(queryClient, 'ada_lovelace');

    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(false);
  });
});

describe('followListActionMutation', () => {
  const key = profileKeys.followList('ada_lovelace', 'followers');
  const change = { userId: 'a', action: 'removeFollower' } as const;
  const optionsFor = (
    queryClient: QueryClient,
    notify: (message: string) => void = vi.fn(),
  ): FollowListActionOptions => ({
    queryClient,
    username: 'ada_lovelace',
    side: 'followers',
    translate: (code: ApiErrorCode) => `message:${code}`,
    notify,
  });

  it('sends the request of the row when it runs', async () => {
    mockBrowserApi.mockResolvedValue(undefined);
    const mutation = followListActionMutation(optionsFor(new QueryClient()));

    await mutation.mutationFn(change);

    expect(mockBrowserApi).toHaveBeenCalledWith('/me/followers/a', {
      method: 'DELETE',
      schema: expect.anything(),
    });
  });

  it('takes the row out of the list at once, and keeps what it held', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, pages(['a', 'b']));
    const mutation = followListActionMutation(optionsFor(queryClient));

    const context = await mutation.onMutate(change);

    expect(idsOf(queryClient.getQueryData(key))).toEqual([['b']]);
    expect(idsOf(context.previous)).toEqual([['a', 'b']]);
  });

  it('puts the list back and shows the translated message when the request fails', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, pages(['a', 'b']));
    const notify = vi.fn();
    const mutation = followListActionMutation(optionsFor(queryClient, notify));
    const context = await mutation.onMutate(change);

    mutation.onError(new Error('connection lost'), change, context);

    expect(idsOf(queryClient.getQueryData(key))).toEqual([['a', 'b']]);
    expect(notify).toHaveBeenCalledWith('message:INTERNAL_ERROR');
  });

  it('reads the counts again once the request settles, whatever its outcome', async () => {
    const queryClient = new QueryClient();
    const counts = profileKeys.counts('ada_lovelace');
    queryClient.setQueryData(counts, {});
    const mutation = followListActionMutation(optionsFor(queryClient));

    await mutation.onSettled();

    expect(queryClient.getQueryState(counts)?.isInvalidated).toBe(true);
  });
});
