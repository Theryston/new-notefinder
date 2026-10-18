import { describe, expect, it, vi } from 'vitest';

import { sitemapFileResponse } from './sitemap-file-response';

const toXml = (items: readonly { id: string }[]) =>
  `<urlset>${items.map((item) => item.id).join(',')}</urlset>`;

const respond = (
  path: string[],
  read: (index: number) => Promise<{ id: string }[] | undefined>,
) => sitemapFileResponse({ name: 'tracks', path, read, toXml });

describe('sitemapFileResponse', () => {
  it('answers the file as XML with the full cache and the host Vary', async () => {
    const read = vi.fn().mockResolvedValue([{ id: 'clx1' }]);

    const response = await respond(['2.xml'], read);

    expect(read).toHaveBeenCalledWith(2);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/xml; charset=utf-8',
    );
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
    expect(response.headers.get('vary')).toBe('X-Forwarded-Host, Host');
    expect(await response.text()).toBe('<urlset>clx1</urlset>');
  });

  it('answers 404 past the last file', async () => {
    const response = await respond(['9.xml'], async () => undefined);

    expect(response.status).toBe(404);
  });

  it('answers 404 for a path that is not a shard, without reading anything', async () => {
    const read = vi.fn();

    expect((await respond(['nope.xml'], read)).status).toBe(404);
    expect((await respond(['0.xml', 'extra'], read)).status).toBe(404);
    expect(read).not.toHaveBeenCalled();
  });

  it('answers a failed read as an empty valid file with a short cache, and logs it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await respond(['0.xml'], async () => {
      throw new Error('upstream down');
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=60');
    expect(response.headers.get('vary')).toBe('X-Forwarded-Host, Host');
    expect(await response.text()).toBe('<urlset></urlset>');
    expect(error).toHaveBeenCalledWith(
      'Sitemap tracks/0.xml could not be read, answering it empty: upstream down',
    );
  });
});
