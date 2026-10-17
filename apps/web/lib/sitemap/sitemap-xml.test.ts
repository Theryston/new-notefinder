import { describe, expect, it } from 'vitest';

import {
  buildSitemapIndex,
  buildSitemapUrlset,
  parseSitemapShardName,
  type SitemapChangefreq,
  type SitemapContentType,
  type SitemapImage,
  type SitemapUrlEntry,
  type SitemapVideo,
  sitemapContentMeta,
} from './sitemap-xml';

const site = 'https://notefinder.com.br/';

const track = (
  path: string,
  updatedAt = '2026-10-14T12:00:00.000Z',
  type: SitemapContentType = 'track',
): SitemapUrlEntry => ({ path, updatedAt, type });

const locsOf = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '');

describe('buildSitemapUrlset', () => {
  it('lists every entry once per locale in input order', () => {
    const xml = buildSitemapUrlset(
      [track('/tracks/clx-hot'), track('/tracks/clx-cold')],
      site,
    );

    expect(locsOf(xml)).toEqual([
      'https://notefinder.com.br/en/tracks/clx-hot',
      'https://notefinder.com.br/pt-BR/tracks/clx-hot',
      'https://notefinder.com.br/en/tracks/clx-cold',
      'https://notefinder.com.br/pt-BR/tracks/clx-cold',
    ]);
  });

  it('points each URL at all translations plus an x-default fallback', () => {
    const xml = buildSitemapUrlset([track('/tracks/clx-hot')], site);

    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://notefinder.com.br/en/tracks/clx-hot"/>',
    );
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="pt-BR" href="https://notefinder.com.br/pt-BR/tracks/clx-hot"/>',
    );
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://notefinder.com.br/tracks/clx-hot"/>',
    );
  });

  it('keeps the home page on the canonical locale shape', () => {
    const xml = buildSitemapUrlset(
      [{ path: '/', updatedAt: '2026-10-01T00:00:00.000Z', type: 'home' }],
      site,
    );

    expect(locsOf(xml)).toEqual([
      'https://notefinder.com.br/en',
      'https://notefinder.com.br/pt-BR',
    ]);
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://notefinder.com.br/"/>',
    );
  });

  it('carries lastmod, per-type priority and changefreq', () => {
    const xml = buildSitemapUrlset(
      [
        track('/tracks/clx-hot', '2026-10-14T12:00:00.000Z'),
        {
          path: '/sign-in',
          updatedAt: '2026-09-01T00:00:00.000Z',
          type: 'auth',
        },
      ],
      site,
    );
    const trackMeta = sitemapContentMeta.track;
    const authMeta = sitemapContentMeta.auth;

    expect(xml).toContain('<lastmod>2026-10-14T12:00:00.000Z</lastmod>');
    expect(xml).toContain(
      `<changefreq>${trackMeta.changefreq}</changefreq><priority>${trackMeta.priority.toFixed(1)}</priority>`,
    );
    expect(xml).toContain(
      `<changefreq>${authMeta.changefreq}</changefreq><priority>${authMeta.priority.toFixed(1)}</priority>`,
    );
  });

  it('resolves a valid changefreq for every content type', () => {
    const changefreqs: SitemapChangefreq[] = (
      Object.keys(sitemapContentMeta) as SitemapContentType[]
    ).map((type) => sitemapContentMeta[type].changefreq);

    expect(changefreqs).toHaveLength(7);
    for (const changefreq of changefreqs) {
      expect(typeof changefreq).toBe('string');
    }
    expect(sitemapContentMeta.home.priority).toBeGreaterThan(
      sitemapContentMeta.auth.priority,
    );
  });

  it('adds image and video extensions wherever the entry exposes them', () => {
    const cover: SitemapImage = {
      loc: 'https://cdn.notefinder.com.br/covers/hot.jpg',
      title: 'Hot cover',
      caption: 'Cover art',
    };
    const clip: SitemapVideo = {
      thumbnailLoc: 'https://cdn.notefinder.com.br/thumbs/hot.jpg',
      title: 'Hot video',
      description: 'The video',
      contentLoc: 'https://cdn.notefinder.com.br/videos/hot.mp4',
      duration: 210,
      publicationDate: '2026-10-01T00:00:00.000Z',
    };
    const xml = buildSitemapUrlset(
      [
        {
          path: '/tracks/clx-hot',
          updatedAt: '2026-10-14T12:00:00.000Z',
          type: 'track',
          images: [cover],
          videos: [clip],
        },
      ],
      site,
    );

    expect(xml).toContain(
      '<image:image><image:loc>https://cdn.notefinder.com.br/covers/hot.jpg</image:loc>' +
        '<image:title>Hot cover</image:title>' +
        '<image:caption>Cover art</image:caption></image:image>',
    );
    expect(xml).toContain('<video:thumbnail_loc>');
    expect(xml).toContain('<video:title>Hot video</video:title>');
    expect(xml).toContain('<video:description>The video</video:description>');
    expect(xml).toContain(
      '<video:content_loc>https://cdn.notefinder.com.br/videos/hot.mp4</video:content_loc>',
    );
    expect(xml).toContain('<video:duration>210</video:duration>');
    expect(xml).toContain('xmlns:image=');
    expect(xml).toContain('xmlns:video=');
  });

  it('leaves media tags and namespaces out when entries expose none', () => {
    const xml = buildSitemapUrlset([track('/tracks/clx-hot')], site);

    expect(xml).not.toContain('<image:image>');
    expect(xml).not.toContain('<video:video>');
    expect(xml).not.toContain('xmlns:image=');
    expect(xml).not.toContain('xmlns:video=');
  });

  it('is valid XML even with no entries', () => {
    const xml = buildSitemapUrlset([], site);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset');
    expect(xml.endsWith('</urlset>')).toBe(true);
    expect(xml).not.toContain('<url>');
  });

  it('escapes what XML reserves and encodes path segments', () => {
    const xml = buildSitemapUrlset(
      [
        {
          path: '/users/a&b <c>',
          updatedAt: '2026-10-14T12:00:00.000Z',
          type: 'user',
          images: [
            {
              loc: 'https://cdn.notefinder.com.br/a.jpg',
              title: 'Fish & Chips <best>',
            },
          ],
        },
      ],
      site,
    );

    expect(xml).toContain('/en/users/a%26b%20%3Cc%3E');
    expect(xml).toContain('Fish &amp; Chips &lt;best&gt;');
    expect(xml).not.toContain('a&b <c>');
  });
});

describe('buildSitemapIndex', () => {
  it('lists child shards with absolute per-domain URLs', () => {
    const xml = buildSitemapIndex(
      [
        { path: '/sitemaps/tracks-0.xml', lastmod: '2026-10-14T00:00:00.000Z' },
        { path: '/sitemaps/pages-0.xml' },
      ],
      'https://notefinder.com.br',
    );

    expect(locsOf(xml)).toEqual([
      'https://notefinder.com.br/sitemaps/tracks-0.xml',
      'https://notefinder.com.br/sitemaps/pages-0.xml',
    ]);
    expect(xml).toContain('<lastmod>2026-10-14T00:00:00.000Z</lastmod>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('is valid XML with no shards', () => {
    const xml = buildSitemapIndex([], site);

    expect(xml.endsWith('</sitemapindex>')).toBe(true);
    expect(xml).not.toContain('<sitemap><loc>');
  });
});

describe('parseSitemapShardName', () => {
  it.each([
    ['0.xml', 0],
    ['12.xml', 12],
    ['007.xml', 7],
  ])('reads %s as shard %i', (name, shard) => {
    expect(parseSitemapShardName(name)).toBe(shard);
  });

  it.each([
    [''],
    ['0'],
    ['x.xml'],
    ['-1.xml'],
    ['1.5.xml'],
    ['12.XML'],
    ['0.xml '],
  ])('refuses %j', (name) => {
    expect(parseSitemapShardName(name)).toBeUndefined();
  });
});
