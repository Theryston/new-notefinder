import { describe, expect, it } from 'vitest';

import { sitemapPageIndex, trackSitemapXml } from './track-sitemap-xml';

describe('trackSitemapXml', () => {
  const entries = [
    { id: 'clx-hot', updatedAt: '2026-10-14T12:00:00.000Z' },
    { id: 'clx-cold', updatedAt: '2026-10-01T08:30:00.000Z' },
  ];

  it('lists each Track in each locale, in the order given, with its translations', () => {
    const xml = trackSitemapXml(entries, 'https://vozzify.com/');

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    );
    expect(locs).toEqual([
      'https://vozzify.com/en/tracks/clx-hot',
      'https://vozzify.com/pt-BR/tracks/clx-hot',
      'https://vozzify.com/en/tracks/clx-cold',
      'https://vozzify.com/pt-BR/tracks/clx-cold',
    ]);
    expect(xml).toContain('<lastmod>2026-10-14T12:00:00.000Z</lastmod>');
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="pt-BR" href="https://vozzify.com/pt-BR/tracks/clx-hot"/>',
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('is a valid empty sitemap with no Tracks', () => {
    expect(trackSitemapXml([], 'https://vozzify.com')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"></urlset>',
    );
  });

  it('escapes what XML reserves', () => {
    const xml = trackSitemapXml(
      [{ id: 'a&b', updatedAt: '2026-10-14T12:00:00.000Z' }],
      'https://vozzify.com',
    );

    expect(xml).toContain('/en/tracks/a%26b');
    expect(xml).not.toContain('a&b');
  });

  it('gives each Track URL x-default, its changefreq and its priority', () => {
    const xml = trackSitemapXml(
      [{ id: 'clx-hot', updatedAt: '2026-10-14T12:00:00.000Z' }],
      'https://vozzify.com',
    );

    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://vozzify.com/tracks/clx-hot"/>',
    );
    expect(xml).toContain(
      '<changefreq>daily</changefreq><priority>0.8</priority>',
    );
  });

  it('lists a Track cover as its image in every locale URL, and only when there is one', () => {
    const xml = trackSitemapXml(
      [
        {
          id: 'clx-cover',
          updatedAt: '2026-10-14T12:00:00.000Z',
          coverUrl: 'https://files.example/cover.jpg',
        },
        {
          id: 'clx-bare',
          updatedAt: '2026-10-14T12:00:00.000Z',
          coverUrl: null,
        },
      ],
      'https://vozzify.com',
    );

    // Two locale URLs per Track: the first pair is the covered Track.
    const urls = xml.split('<url>').slice(1);
    expect(urls).toHaveLength(4);
    for (const url of urls.slice(0, 2)) {
      expect(url).toContain(
        '<image:image><image:loc>https://files.example/cover.jpg</image:loc></image:image>',
      );
    }
    for (const url of urls.slice(2)) {
      expect(url).not.toContain('<image:image>');
    }
    expect(xml).toContain(
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    );
  });

  it('keeps a Track ID with a slash inside one encoded segment', () => {
    const xml = trackSitemapXml(
      [{ id: 'a/b', updatedAt: '2026-10-14T12:00:00.000Z' }],
      'https://vozzify.com',
    );

    expect(xml).toContain('https://vozzify.com/en/tracks/a%2Fb');
    expect(xml).not.toContain('/tracks/a/b');
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
