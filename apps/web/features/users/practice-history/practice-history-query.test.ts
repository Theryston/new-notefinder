import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import { practiceHistoryQueryOptions } from './practice-history-query';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

describe('practiceHistoryQueryOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keys the history by the username', () => {
    const options = practiceHistoryQueryOptions({ username: 'ada_lovelace' });

    expect(options.queryKey).toEqual([
      'users',
      'ada_lovelace',
      'practice-history',
    ]);
  });

  it('fetches the next page with its cursor and the page size', async () => {
    const options = practiceHistoryQueryOptions({ username: 'ada lovelace' });
    mockBrowserApi.mockResolvedValue({ items: [], nextCursor: null });

    const { queryFn } = options;
    if (typeof queryFn !== 'function') {
      throw new Error('the history query has no fetcher');
    }
    await queryFn({
      pageParam: 'cursor-2',
      signal: new AbortController().signal,
      queryKey: options.queryKey,
      meta: undefined,
    } as never);

    expect(mockBrowserApi).toHaveBeenCalledWith(
      '/users/ada%20lovelace/attempts',
      expect.objectContaining({ query: { cursor: 'cursor-2', limit: 20 } }),
    );
  });
});
