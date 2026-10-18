import { cacheTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serverApi } from '@/lib/api/server';

import { getArtistSitemapFile } from './sitemap-queries';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

const page = (ids: string[], nextCursor: string | null) => ({
  items: ids.map((id) => ({ id, updatedAt: '2026-10-14T12:00:00.000Z' })),
  nextCursor,
});

describe('getArtistSitemapFile', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
  });

  it('reads the first file from the Artists listing, under the sitemap tag', async () => {
    mockServerApi.mockResolvedValueOnce(page(['art-a'], null));

    await expect(getArtistSitemapFile(0)).resolves.toEqual(
      page(['art-a'], null).items,
    );

    expect(mockServerApi).toHaveBeenCalledWith('/sitemaps/artists', {
      query: { limit: 5000, cursor: undefined },
      schema: expect.anything(),
    });
    expect(cacheTag).toHaveBeenCalledWith('sitemap');
  });

  it('walks the cursors of the earlier files to reach a later one', async () => {
    mockServerApi
      .mockResolvedValueOnce(page(['art-a'], 'cursor-1'))
      .mockResolvedValueOnce(page(['art-b'], 'cursor-2'))
      .mockResolvedValueOnce(page(['art-c'], null));

    await expect(getArtistSitemapFile(2)).resolves.toEqual(
      page(['art-c'], null).items,
    );

    expect(mockServerApi).toHaveBeenCalledTimes(3);
    expect(mockServerApi).toHaveBeenNthCalledWith(
      2,
      '/sitemaps/artists',
      expect.objectContaining({
        query: { limit: 5000, cursor: 'cursor-1' },
      }),
    );
    expect(mockServerApi).toHaveBeenNthCalledWith(
      3,
      '/sitemaps/artists',
      expect.objectContaining({
        query: { limit: 5000, cursor: 'cursor-2' },
      }),
    );
  });

  it('is undefined past the last file', async () => {
    mockServerApi.mockResolvedValueOnce(page(['art-a'], null));

    await expect(getArtistSitemapFile(1)).resolves.toBeUndefined();
  });
});
