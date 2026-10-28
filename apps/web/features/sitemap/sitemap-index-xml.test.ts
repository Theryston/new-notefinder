import { describe, expect, it } from 'vitest';

import { sitemapIndexXml } from './sitemap-index-xml';

const origin = 'https://vozzify.com';

describe('sitemapIndexXml', () => {
  it('lists the five content sitemaps with absolute URLs for the host', () => {
    const xml = sitemapIndexXml(origin);

    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(
      (match) => match[1],
    );
    expect(locs).toEqual([
      `${origin}/pages/sitemap/0.xml`,
      `${origin}/tracks/sitemap/0.xml`,
      `${origin}/albums/sitemap/0.xml`,
      `${origin}/artists/sitemap/0.xml`,
      `${origin}/users/sitemap/0.xml`,
    ]);
  });

  it('is a sitemap index document in the sitemap namespace', () => {
    const xml = sitemapIndexXml(origin);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(xml.endsWith('</sitemapindex>')).toBe(true);
  });

  it('points at the requested host, not another domain', () => {
    const xml = sitemapIndexXml('http://localhost:3000/');

    expect(xml).toContain(
      '<loc>http://localhost:3000/tracks/sitemap/0.xml</loc>',
    );
    expect(xml).not.toContain('vozzify.com');
  });
});
