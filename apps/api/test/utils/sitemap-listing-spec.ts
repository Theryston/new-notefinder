import type { Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SitemapQuery } from '@notefinder/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeSitemapCursor } from '../../src/common/sitemap/sitemap-cursor.js';

/** The one method every entity sitemap service exposes. */
export type SitemapListingService = {
  list(query: SitemapQuery): Promise<{
    items: { id: string; updatedAt: string }[];
    nextCursor: string | null;
  }>;
};

const UPDATED = new Date('2026-10-14T12:00:00.000Z');

/**
 * The behavior all three entity sitemap services share, tested once: they ask
 * the repository for `limit + 1` rows, end a page on its last ID and resume
 * after the ID a cursor holds. The repository is mocked; `listAfter` is the
 * only method the service calls.
 */
export const describeSitemapListing = (
  name: string,
  service: Type<SitemapListingService>,
  repository: Type<unknown>,
): void => {
  describe(name, () => {
    const sitemap = { listAfter: vi.fn() };
    let listing: SitemapListingService;

    beforeEach(async () => {
      vi.clearAllMocks();
      const moduleRef = await Test.createTestingModule({
        providers: [service, { provide: repository, useValue: sitemap }],
      }).compile();
      listing = moduleRef.get(service);
    });

    it('lists one row more than the limit, then ends the page on its last ID', async () => {
      sitemap.listAfter.mockResolvedValue([
        { id: 'a', updatedAt: UPDATED },
        { id: 'b', updatedAt: UPDATED },
        { id: 'c', updatedAt: UPDATED },
      ]);

      const page = await listing.list({ limit: 2 });

      expect(sitemap.listAfter).toHaveBeenCalledWith({
        after: undefined,
        limit: 3,
      });
      expect(page.items.map((item) => item.id)).toEqual(['a', 'b']);
      expect(page.nextCursor).toBe(encodeSitemapCursor('b'));
    });

    it('resumes after the ID its cursor holds', async () => {
      sitemap.listAfter.mockResolvedValue([]);

      await listing.list({ limit: 2, cursor: encodeSitemapCursor('b') });

      expect(sitemap.listAfter).toHaveBeenCalledWith({
        after: 'b',
        limit: 3,
      });
    });
  });
};
