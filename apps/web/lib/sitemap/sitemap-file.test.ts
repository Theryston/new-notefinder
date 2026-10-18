import { describe, expect, it, vi } from 'vitest';

import { sitemapFileItems } from './sitemap-file';

const pageOf = (items: string[], nextCursor: string | null) => ({
  items,
  nextCursor,
});

describe('sitemapFileItems', () => {
  it('reads the first file from the start, with no cursor', async () => {
    const readPage = vi.fn().mockResolvedValueOnce(pageOf(['a'], null));

    await expect(sitemapFileItems(readPage, 0)).resolves.toEqual(['a']);
    expect(readPage).toHaveBeenCalledTimes(1);
    expect(readPage).toHaveBeenCalledWith(undefined);
  });

  it('walks the cursors of the earlier files to reach a later one', async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(pageOf(['a'], 'cursor-1'))
      .mockResolvedValueOnce(pageOf(['b'], 'cursor-2'))
      .mockResolvedValueOnce(pageOf(['c'], null));

    await expect(sitemapFileItems(readPage, 2)).resolves.toEqual(['c']);
    expect(readPage).toHaveBeenNthCalledWith(2, 'cursor-1');
    expect(readPage).toHaveBeenNthCalledWith(3, 'cursor-2');
  });

  it('is undefined past the last file, without reading the page after it', async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(pageOf(['a'], 'cursor-1'))
      .mockResolvedValueOnce(pageOf(['b'], null));

    await expect(sitemapFileItems(readPage, 2)).resolves.toBeUndefined();
    expect(readPage).toHaveBeenCalledTimes(2);
  });
});
