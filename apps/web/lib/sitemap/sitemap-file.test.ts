import { describe, expect, it, vi } from 'vitest';

import { readSitemapFile, sitemapFileItems } from './sitemap-file';

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

describe('readSitemapFile', () => {
  it('answers the items as a complete file', async () => {
    await expect(
      readSitemapFile('tracks/0.xml', async () => ['a', 'b']),
    ).resolves.toEqual({ items: ['a', 'b'], partial: false });
  });

  it('answers undefined past the last file, without logging a failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      readSitemapFile('tracks/9.xml', async () => undefined),
    ).resolves.toBeUndefined();
    expect(error).not.toHaveBeenCalled();
  });

  it('logs an upstream failure and answers an empty partial file, never throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      readSitemapFile('albums/0.xml', async () => {
        throw new Error('API 503');
      }),
    ).resolves.toEqual({ items: [], partial: true });
    expect(error).toHaveBeenCalledWith(
      'Sitemap albums/0.xml could not be read, answering it empty: API 503',
    );
  });

  it('logs a non-Error failure too', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await readSitemapFile('users/0.xml', () => Promise.reject('timeout'));

    expect(error).toHaveBeenCalledWith(
      'Sitemap users/0.xml could not be read, answering it empty: timeout',
    );
  });
});
