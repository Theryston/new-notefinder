import { describe, expect, it, vi } from 'vitest';

import { countSitemapFiles } from './sitemap-file';

const pageOf = (nextCursor: string | null) => ({ items: ['x'], nextCursor });

describe('countSitemapFiles', () => {
  it('counts one file per page, walking the cursors to the last page', async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(pageOf('cursor-1'))
      .mockResolvedValueOnce(pageOf('cursor-2'))
      .mockResolvedValueOnce(pageOf(null));

    await expect(countSitemapFiles('albums', readPage)).resolves.toBe(3);
    expect(readPage).toHaveBeenNthCalledWith(1, undefined);
    expect(readPage).toHaveBeenNthCalledWith(3, 'cursor-2');
  });

  it('counts a single page as one file, even an empty one', async () => {
    const readPage = vi.fn().mockResolvedValue({ items: [], nextCursor: null });

    await expect(countSitemapFiles('users', readPage)).resolves.toBe(1);
  });

  it('logs a failed page and counts the pages read before it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(pageOf('cursor-1'))
      .mockRejectedValueOnce(new Error('API 503'));

    await expect(countSitemapFiles('artists', readPage)).resolves.toBe(1);
    expect(error).toHaveBeenCalledWith(
      'Sitemap artists could not be counted, listing the 1 file(s) read so far: API 503',
    );
  });

  it('never counts below one, even when the first read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const readPage = vi.fn().mockRejectedValue(new Error('down'));

    await expect(countSitemapFiles('albums', readPage)).resolves.toBe(1);
  });
});
