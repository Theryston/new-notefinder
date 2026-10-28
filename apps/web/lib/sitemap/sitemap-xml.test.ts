import { describe, expect, it } from 'vitest';

import {
  buildSitemapIndex,
  buildSitemapUrlset,
  parseSitemapShardName,
  type SitemapContentType,
  type SitemapImage,
  type SitemapUrlEntry,
  type SitemapVideo,
  sitemapContentMeta,
} from './sitemap-xml';

const site = 'https://vozzify.com/';
const updatedAt = '2026-10-14T12:00:00.000Z';

const entry = (
  segments: readonly string[],
  type: SitemapContentType = 'track',
  extra: Partial<SitemapUrlEntry> = {},
): SitemapUrlEntry => ({ segments, updatedAt, type, ...extra });

const locsOf = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '');

/** Each `<url>` element as its own string, in document order. */
const urlsOf = (xml: string): string[] => xml.split('<url>').slice(1);

const alternatesOf = (url: string): string[] =>
  [...url.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(
    (match) => `${match[1]} ${match[2]}`,
  );

describe('buildSitemapUrlset', () => {
  it('lists every entry once per locale in input order', () => {
    const xml = buildSitemapUrlset(
      [entry(['tracks', 'clx-hot']), entry(['tracks', 'clx-cold'])],
      site,
    );

    expect(locsOf(xml)).toEqual([
      'https://vozzify.com/en/tracks/clx-hot',
      'https://vozzify.com/pt-BR/tracks/clx-hot',
      'https://vozzify.com/en/tracks/clx-cold',
      'https://vozzify.com/pt-BR/tracks/clx-cold',
    ]);
  });

  it('gives every locale URL the full en, pt-BR and x-default set', () => {
    const xml = buildSitemapUrlset([entry(['tracks', 'clx-hot'])], site);
    const urls = urlsOf(xml);

    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(alternatesOf(url)).toEqual([
        'en https://vozzify.com/en/tracks/clx-hot',
        'pt-BR https://vozzify.com/pt-BR/tracks/clx-hot',
        'x-default https://vozzify.com/tracks/clx-hot',
      ]);
    }
  });

  it('keeps the home page on the canonical locale shape', () => {
    const xml = buildSitemapUrlset(
      [entry([], 'home', { updatedAt: '2026-10-01T00:00:00.000Z' })],
      site,
    );

    expect(locsOf(xml)).toEqual([
      'https://vozzify.com/en',
      'https://vozzify.com/pt-BR',
    ]);
    for (const url of urlsOf(xml)) {
      expect(alternatesOf(url)).toEqual([
        'en https://vozzify.com/en',
        'pt-BR https://vozzify.com/pt-BR',
        'x-default https://vozzify.com/',
      ]);
    }
  });

  it('carries lastmod, the literal priority and changefreq of its type', () => {
    const xml = buildSitemapUrlset(
      [
        entry(['tracks', 'clx-hot'], 'track'),
        entry(['sign-in'], 'auth', { updatedAt: '2026-09-01T00:00:00.000Z' }),
      ],
      site,
    );

    expect(xml).toContain('<lastmod>2026-10-14T12:00:00.000Z</lastmod>');
    expect(xml).toContain(
      '<changefreq>daily</changefreq><priority>0.8</priority>',
    );
    expect(xml).toContain(
      '<changefreq>monthly</changefreq><priority>0.3</priority>',
    );
    expect(xml).toContain('<lastmod>2026-09-01T00:00:00.000Z</lastmod>');
  });

  it('ranks home first, catalog above general pages, and auth last', () => {
    const { home, track, album, artist, user, page, auth } = sitemapContentMeta;

    expect(home.priority).toBe(1);
    expect(track.priority).toBe(0.8);
    expect(album.priority).toBe(0.7);
    expect(artist.priority).toBe(0.7);
    expect(user.priority).toBe(0.6);
    expect(page.priority).toBe(0.6);
    expect(auth.priority).toBe(0.3);

    expect(home.priority).toBeGreaterThan(track.priority);
    expect(track.priority).toBeGreaterThan(album.priority);
    expect(album.priority).toBeGreaterThan(page.priority);
    expect(page.priority).toBeGreaterThan(auth.priority);
  });

  it('adds image tags with their values wherever the entry exposes them', () => {
    const cover: SitemapImage = {
      loc: 'https://cdn.vozzify.com/covers/hot.jpg',
      title: 'Hot cover',
      caption: 'Cover art',
    };
    const xml = buildSitemapUrlset(
      [entry(['tracks', 'clx-hot'], 'track', { images: [cover] })],
      site,
    );

    expect(xml).toContain(
      '<image:image><image:loc>https://cdn.vozzify.com/covers/hot.jpg</image:loc>' +
        '<image:title>Hot cover</image:title>' +
        '<image:caption>Cover art</image:caption></image:image>',
    );
    expect(xml).toContain('xmlns:image=');
  });

  it('adds video tags with their values, including player and publication date', () => {
    const clip: SitemapVideo = {
      thumbnailLoc: 'https://cdn.vozzify.com/thumbs/hot.jpg',
      title: 'Hot video',
      description: 'The video',
      playerLoc: 'https://vozzify.com/en/tracks/clx-hot',
      duration: 210,
      publicationDate: '2026-10-01T00:00:00.000Z',
    };
    const xml = buildSitemapUrlset(
      [entry(['tracks', 'clx-hot'], 'track', { videos: [clip] })],
      site,
    );

    expect(xml).toContain(
      '<video:thumbnail_loc>https://cdn.vozzify.com/thumbs/hot.jpg</video:thumbnail_loc>',
    );
    expect(xml).toContain('<video:title>Hot video</video:title>');
    expect(xml).toContain('<video:description>The video</video:description>');
    expect(xml).toContain(
      '<video:player_loc>https://vozzify.com/en/tracks/clx-hot</video:player_loc>',
    );
    expect(xml).not.toContain('<video:content_loc>');
    expect(xml).toContain('<video:duration>210</video:duration>');
    expect(xml).toContain(
      '<video:publication_date>2026-10-01T00:00:00.000Z</video:publication_date>',
    );
    expect(xml).toContain('xmlns:video=');
  });

  it.each([
    [209.6, '210'],
    [1, '1'],
    [28_800, '28800'],
    [0, undefined],
    [0.4, undefined],
    [28_801, undefined],
    [Number.NaN, undefined],
  ])(
    'writes duration %s as %s, leaving it out when outside 1..28800',
    (duration, expected) => {
      const xml = buildSitemapUrlset(
        [
          entry(['tracks', 'clx-hot'], 'track', {
            videos: [
              {
                thumbnailLoc: 'https://cdn.vozzify.com/t.jpg',
                title: 'T',
                description: 'D',
                contentLoc: 'https://cdn.vozzify.com/v.mp4',
                duration,
              },
            ],
          }),
        ],
        site,
      );

      if (expected === undefined) {
        expect(xml).not.toContain('<video:duration>');
      } else {
        expect(xml).toContain(`<video:duration>${expected}</video:duration>`);
      }
    },
  );

  it('requires a content or a player location on every video', () => {
    const base = {
      thumbnailLoc: 'https://cdn.vozzify.com/t.jpg',
      title: 'T',
      description: 'D',
    };
    const byContent: SitemapVideo = {
      ...base,
      contentLoc: 'https://cdn.vozzify.com/v.mp4',
    };
    const byPlayer: SitemapVideo = {
      ...base,
      playerLoc: 'https://vozzify.com/en/tracks/clx-hot',
    };
    // @ts-expect-error a video with neither location is not a SitemapVideo
    const withoutLocation: SitemapVideo = base;

    expect([byContent, byPlayer, withoutLocation]).toHaveLength(3);
  });

  it('leaves media tags and namespaces out when entries expose none', () => {
    const xml = buildSitemapUrlset([entry(['tracks', 'clx-hot'])], site);

    expect(xml).not.toContain('<image:image>');
    expect(xml).not.toContain('<video:video>');
    expect(xml).not.toContain('xmlns:image=');
    expect(xml).not.toContain('xmlns:video=');
  });

  it('is valid XML even with no entries', () => {
    const xml = buildSitemapUrlset([], site);

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"></urlset>',
    );
  });

  it('encodes each segment once, so a slash in an ID stays inside it', () => {
    const xml = buildSitemapUrlset([entry(['tracks', 'a/b'])], site);

    expect(locsOf(xml)[0]).toBe('https://vozzify.com/en/tracks/a%2Fb');
    expect(xml).not.toContain('a/b');
  });

  it('does not double-encode, and keeps `?` and spaces inside their segment', () => {
    const xml = buildSitemapUrlset(
      [entry(['users', 'ana maria?x'], 'user')],
      site,
    );

    expect(locsOf(xml)[0]).toBe('https://vozzify.com/en/users/ana%20maria%3Fx');
    expect(xml).not.toContain('%2520');
  });

  it('escapes what XML reserves in text and in attributes', () => {
    const xml = buildSitemapUrlset(
      [
        entry(['users', 'a&b'], 'user', {
          images: [
            {
              loc: 'https://cdn.vozzify.com/a.jpg',
              title: 'Fish & Chips <best>',
            },
          ],
        }),
      ],
      site,
    );

    expect(locsOf(xml)[0]).toBe('https://vozzify.com/en/users/a%26b');
    expect(xml).toContain('Fish &amp; Chips &lt;best&gt;');
    expect(xml).not.toContain('a&b');
  });
});

describe('buildSitemapIndex', () => {
  it('lists child shards with absolute per-domain URLs', () => {
    const xml = buildSitemapIndex(
      [
        {
          segments: ['tracks', 'sitemap', '0.xml'],
          lastmod: '2026-10-14T00:00:00.000Z',
        },
        { segments: ['albums', 'sitemap', '1.xml'] },
      ],
      'https://vozzify.com',
    );

    expect(locsOf(xml)).toEqual([
      'https://vozzify.com/tracks/sitemap/0.xml',
      'https://vozzify.com/albums/sitemap/1.xml',
    ]);
    expect(xml).toContain('<lastmod>2026-10-14T00:00:00.000Z</lastmod>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('is valid XML with no shards', () => {
    const xml = buildSitemapIndex([], site);

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>',
    );
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
