import { cacheTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serverApi } from '@/lib/api/server';

import { getTrackSitemapFile } from './sitemap-queries';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

const page = (ids: string[], nextCursor: string | null) => ({
  items: ids.map((id) => ({ id, updatedAt: '2026-10-14T12:00:00.000Z' })),
  nextCursor,
});

describe('getTrackSitemapFile', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
  });

  it('reads the first file from the start, under the sitemap tag', async () => {
    mockServerApi.mockResolvedValueOnce(page(['a', 'b'], null));

    await expect(getTrackSitemapFile(0)).resolves.toEqual(
      page(['a', 'b'], null).items,
    );

    expect(mockServerApi).toHaveBeenCalledWith('/sitemaps/tracks', {
      query: { limit: 5000, cursor: undefined },
      schema: expect.anything(),
    });
    expect(cacheTag).toHaveBeenCalledWith('sitemap');
  });

  it('walks the cursors of the earlier files to reach a later one', async () => {
    mockServerApi
      .mockResolvedValueOnce(page(['a'], 'cursor-1'))
      .mockResolvedValueOnce(page(['b'], null));

    await expect(getTrackSitemapFile(1)).resolves.toEqual(
      page(['b'], null).items,
    );

    expect(mockServerApi).toHaveBeenNthCalledWith(
      2,
      '/sitemaps/tracks',
      expect.objectContaining({
        query: { limit: 5000, cursor: 'cursor-1' },
      }),
    );
  });

  it('is undefined past the last file', async () => {
    mockServerApi.mockResolvedValueOnce(page(['a'], null));

    await expect(getTrackSitemapFile(3)).resolves.toBeUndefined();
  });
});
