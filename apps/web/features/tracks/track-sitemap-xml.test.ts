import { describe, expect, it } from 'vitest';

import { sitemapPageIndex, trackSitemapXml } from './track-sitemap-xml';

describe('trackSitemapXml', () => {
  const entries = [
    { id: 'clx-hot', updatedAt: '2026-10-14T12:00:00.000Z' },
    { id: 'clx-cold', updatedAt: '2026-10-01T08:30:00.000Z' },
  ];

  it('lists each Track in each locale, in the order given, with its translations', () => {
    const xml = trackSitemapXml(entries, 'https://notefinder.com.br/');

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    );
    expect(locs).toEqual([
      'https://notefinder.com.br/en/tracks/clx-hot',
      'https://notefinder.com.br/pt-BR/tracks/clx-hot',
      'https://notefinder.com.br/en/tracks/clx-cold',
      'https://notefinder.com.br/pt-BR/tracks/clx-cold',
    ]);
    expect(xml).toContain('<lastmod>2026-10-14T12:00:00.000Z</lastmod>');
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="pt-BR" href="https://notefinder.com.br/pt-BR/tracks/clx-hot"/>',
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('is a valid empty sitemap with no Tracks', () => {
    expect(trackSitemapXml([], 'https://notefinder.com.br')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"></urlset>',
    );
  });

  it('escapes what XML reserves', () => {
    const xml = trackSitemapXml(
      [{ id: 'a&b', updatedAt: '2026-10-14T12:00:00.000Z' }],
      'https://notefinder.com.br',
    );

    expect(xml).toContain('/en/tracks/a%26b');
    expect(xml).not.toContain('a&b');
  });
});

describe('sitemapPageIndex', () => {
  it.each([
    [['0.xml'], 0],
    [['12.xml'], 12],
  ])('reads %j as page %i', (path, index) => {
    expect(sitemapPageIndex(path)).toBe(index);
  });

  it.each([[[]], [['0']], [['x.xml']], [['0.xml', 'more']], [['-1.xml']]])(
    'refuses %j',
    (path) => {
      expect(sitemapPageIndex(path)).toBeUndefined();
    },
  );
});
