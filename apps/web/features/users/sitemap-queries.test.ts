import { SITEMAP_PAGE_SIZE } from '@notefinder/contracts';
import { cacheTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serverApi } from '@/lib/api/server';

import { getUserSitemapFile } from './sitemap-queries';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

const page = (usernames: string[], nextCursor: string | null) => ({
  items: usernames.map((username, index) => ({
    id: `user-${index}`,
    username,
    updatedAt: '2026-10-14T12:00:00.000Z',
  })),
  nextCursor,
});

describe('getUserSitemapFile', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
  });

  it('reads the first file from the start, under the sitemap tag', async () => {
    mockServerApi.mockResolvedValueOnce(page(['grace', 'ada'], null));

    await expect(getUserSitemapFile(0)).resolves.toEqual(
      page(['grace', 'ada'], null).items,
    );

    expect(mockServerApi).toHaveBeenCalledWith('/sitemaps/users', {
      query: { limit: 5000, cursor: undefined },
      schema: expect.anything(),
    });
    expect(cacheTag).toHaveBeenCalledWith('sitemap');
  });

  it('walks the cursors of the earlier files to reach a later one', async () => {
    mockServerApi
      .mockResolvedValueOnce(page(['grace'], 'cursor-1'))
      .mockResolvedValueOnce(page(['ada'], null));

    await expect(getUserSitemapFile(1)).resolves.toEqual(
      page(['ada'], null).items,
    );

    expect(mockServerApi).toHaveBeenNthCalledWith(
      2,
      '/sitemaps/users',
      expect.objectContaining({
        query: { limit: 5000, cursor: 'cursor-1' },
      }),
    );
  });

  it('is undefined past the last file', async () => {
    mockServerApi.mockResolvedValueOnce(page(['grace'], null));

    await expect(getUserSitemapFile(3)).resolves.toBeUndefined();
  });

  // The API sets `nextCursor` only when its `limit + 1` lookahead finds a row
  // past the page (apps/api/src/common/sitemap/sitemap-page.ts). So a last
  // page that is exactly full ends the walk, and the next file is not found
  // rather than an empty 200.
  it('is undefined for the file after an exactly full last page', async () => {
    const fullPage = Array.from(
      { length: SITEMAP_PAGE_SIZE },
      (_, index) => `user${index}`,
    );
    mockServerApi.mockResolvedValueOnce(page(fullPage, null));

    await expect(getUserSitemapFile(1)).resolves.toBeUndefined();
    expect(mockServerApi).toHaveBeenCalledTimes(1);
  });
});
