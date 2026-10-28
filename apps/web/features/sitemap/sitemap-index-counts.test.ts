import { describe, expect, it } from 'vitest';

import { sitemapIndexXml } from './sitemap-index-xml';

const origin = 'https://vozzify.com';

const locsOf = (xml: string) =>
  [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);

describe('sitemapIndexXml file counts', () => {
  it('lists every file of Albums, Artists and Users, in order', () => {
    const xml = sitemapIndexXml(origin, { albums: 3, artists: 2, users: 2 });

    expect(locsOf(xml)).toEqual([
      `${origin}/pages/sitemap/0.xml`,
      `${origin}/tracks/sitemap/0.xml`,
      `${origin}/albums/sitemap/0.xml`,
      `${origin}/albums/sitemap/1.xml`,
      `${origin}/albums/sitemap/2.xml`,
      `${origin}/artists/sitemap/0.xml`,
      `${origin}/artists/sitemap/1.xml`,
      `${origin}/users/sitemap/0.xml`,
      `${origin}/users/sitemap/1.xml`,
    ]);
  });

  it('keeps Pages and Tracks at their first file whatever the counts', () => {
    const locs = locsOf(
      sitemapIndexXml(origin, { albums: 1, artists: 1, users: 1 }),
    );

    expect(locs).toEqual([
      `${origin}/pages/sitemap/0.xml`,
      `${origin}/tracks/sitemap/0.xml`,
      `${origin}/albums/sitemap/0.xml`,
      `${origin}/artists/sitemap/0.xml`,
      `${origin}/users/sitemap/0.xml`,
    ]);
  });
});
