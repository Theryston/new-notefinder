import { SITEMAP_PAGE_SIZE } from '@notefinder/contracts';
import { describe, expect, it, vi } from 'vitest';

import { entitySitemapResponse, entitySitemapXml } from './entity-sitemap';

const origin = 'https://notefinder.com.br';
const entries = [
  { id: 'alb-b', updatedAt: '2026-10-14T12:00:00.000Z' },
  { id: 'alb-a', updatedAt: '2026-10-01T08:30:00.000Z' },
];

const locsOf = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '');

const get = (path: string[], readFile = vi.fn()) =>
  entitySitemapResponse({
    type: 'album',
    path,
    siteUrl: origin,
    readFile,
  });

describe('entitySitemapXml', () => {
  it('lists each entity once per locale, in the order given', () => {
    const xml = entitySitemapXml('album', entries, origin);

    expect(locsOf(xml)).toEqual([
      `${origin}/en/albums/alb-b`,
      `${origin}/pt-BR/albums/alb-b`,
      `${origin}/en/albums/alb-a`,
      `${origin}/pt-BR/albums/alb-a`,
    ]);
  });

  it('gives each URL its lastmod, the album priority and changefreq, and x-default', () => {
    const xml = entitySitemapXml('album', entries.slice(0, 1), origin);

    expect(xml).toContain('<lastmod>2026-10-14T12:00:00.000Z</lastmod>');
    expect(xml).toContain(
      '<changefreq>weekly</changefreq><priority>0.7</priority>',
    );
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="pt-BR" href="${origin}/pt-BR/albums/alb-b"/>`,
    );
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/albums/alb-b"/>`,
    );
  });

  it('builds artist URLs from the artist segment and its own priority', () => {
    const xml = entitySitemapXml(
      'artist',
      [{ id: 'art-1', updatedAt: '2026-10-14T12:00:00.000Z' }],
      origin,
    );

    expect(locsOf(xml)).toEqual([
      `${origin}/en/artists/art-1`,
      `${origin}/pt-BR/artists/art-1`,
    ]);
    expect(xml).toContain(
      '<changefreq>weekly</changefreq><priority>0.7</priority>',
    );
  });

  it('is a valid empty urlset with no entries', () => {
    expect(entitySitemapXml('artist', [], origin)).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"></urlset>',
    );
  });

  it('keeps an ID with a slash inside one encoded segment', () => {
    const xml = entitySitemapXml(
      'album',
      [{ id: 'a/b?c', updatedAt: '2026-10-14T12:00:00.000Z' }],
      origin,
    );

    expect(locsOf(xml)[0]).toBe(`${origin}/en/albums/a%2Fb%3Fc`);
  });

  it('keeps a full file under the 50,000 URLs a sitemap may hold', () => {
    const full = Array.from({ length: SITEMAP_PAGE_SIZE }, (_, index) => ({
      id: `art-${index}`,
      updatedAt: '2026-10-14T12:00:00.000Z',
    }));

    expect(locsOf(entitySitemapXml('artist', full, origin))).toHaveLength(
      SITEMAP_PAGE_SIZE * 2,
    );
    expect(SITEMAP_PAGE_SIZE * 2).toBeLessThanOrEqual(50_000);
  });
});

describe('entitySitemapResponse', () => {
  it('serves the file as XML with the crawler cache headers and Vary', async () => {
    const readFile = vi.fn().mockResolvedValue(entries);

    const response = await get(['2.xml'], readFile);

    expect(readFile).toHaveBeenCalledWith(2);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/xml; charset=utf-8',
    );
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(response.headers.get('vary')).toBe('X-Forwarded-Host, Host');
    expect(await response.text()).toContain(`${origin}/en/albums/alb-b`);
  });

  it('answers 404 past the last file', async () => {
    const response = await get(['9.xml'], vi.fn().mockResolvedValue(undefined));

    expect(response.status).toBe(404);
  });

  it('answers 404 for a path that is not a shard, without reading anything', async () => {
    const readFile = vi.fn();

    expect((await get(['nope.xml'], readFile)).status).toBe(404);
    expect((await get(['0.xml', 'extra'], readFile)).status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
  });
});
