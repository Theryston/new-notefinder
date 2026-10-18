import { cacheLife, cacheTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serverApi } from '@/lib/api/server';

import { getAlbumSitemapFile } from './sitemap-queries';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

const page = (ids: string[], nextCursor: string | null) => ({
  items: ids.map((id) => ({ id, updatedAt: '2026-10-14T12:00:00.000Z' })),
  nextCursor,
});

describe('getAlbumSitemapFile', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
  });

  it('reads the first file from the Albums listing, under the sitemap tag', async () => {
    mockServerApi.mockResolvedValueOnce(page(['alb-a', 'alb-b'], null));

    await expect(getAlbumSitemapFile(0)).resolves.toEqual(
      page(['alb-a', 'alb-b'], null).items,
    );

    expect(mockServerApi).toHaveBeenCalledWith('/sitemaps/albums', {
      query: { limit: 5000, cursor: undefined },
      schema: expect.anything(),
    });
    expect(cacheTag).toHaveBeenCalledWith('sitemap');
    expect(cacheLife).toHaveBeenCalledWith('hours');
  });

  it('walks the cursors of the earlier files to reach a later one', async () => {
    mockServerApi
      .mockResolvedValueOnce(page(['alb-a'], 'cursor-1'))
      .mockResolvedValueOnce(page(['alb-b'], null));

    await expect(getAlbumSitemapFile(1)).resolves.toEqual(
      page(['alb-b'], null).items,
    );

    expect(mockServerApi).toHaveBeenNthCalledWith(
      2,
      '/sitemaps/albums',
      expect.objectContaining({
        query: { limit: 5000, cursor: 'cursor-1' },
      }),
    );
  });

  it('is undefined past the last file', async () => {
    mockServerApi.mockResolvedValueOnce(page(['alb-a'], null));

    await expect(getAlbumSitemapFile(3)).resolves.toBeUndefined();
  });
});
