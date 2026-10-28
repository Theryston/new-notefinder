import { expect, test } from '@playwright/test';

const localOrigin = 'http://localhost:3000';

// The fake API's Tracks listing (fake-track-sitemap.ts): completed Tracks
// only, the most viewed first. The processing one must never be listed. Only
// the hot Track has a cover.
const hot = 'clx-sitemap-hot';
const cold = 'clx-sitemap-cold';
const hotCover = 'https://files.vozzify.example/covers/clx-sitemap-hot.webp';

const locsOf = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? '');

/** The `<url>` blocks of the file, in document order. */
const urlBlocksOf = (xml: string): string[] =>
  [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)].map((match) => match[0]);

/** The `<url>` blocks of one Track: one per locale. */
const blocksOfTrack = (xml: string, id: string): string[] =>
  urlBlocksOf(xml).filter((block) => block.includes(`/tracks/${id}</loc>`));

test.describe('tracks sitemap file', () => {
  test('lists completed Tracks in trending order, each in both locales', async ({
    request,
  }) => {
    const response = await request.get('/tracks/sitemap/0.xml', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/xml');
    expect(response.headers()['cache-control']).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
    const xml = await response.text();
    const listed = locsOf(xml).filter((loc) => loc.includes('clx-sitemap-'));
    expect(listed).toEqual([
      `${localOrigin}/en/tracks/${hot}`,
      `${localOrigin}/pt-BR/tracks/${hot}`,
      `${localOrigin}/en/tracks/${cold}`,
      `${localOrigin}/pt-BR/tracks/${cold}`,
    ]);
    expect(xml).not.toContain('clx-sitemap-processing');
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="pt-BR" href="${localOrigin}/pt-BR/tracks/${hot}"/>`,
    );
  });

  test('gives each Track URL its lastmod, changefreq and priority', async ({
    request,
  }) => {
    const xml = await (await request.get('/tracks/sitemap/0.xml')).text();

    const [english] = blocksOfTrack(xml, hot);
    expect(english).toContain(
      '<lastmod>2026-10-14T12:00:00.000Z</lastmod><changefreq>daily</changefreq><priority>0.8</priority>',
    );
  });

  test('lists the cover as an image on both locale URLs of a Track that has one', async ({
    request,
  }) => {
    const xml = await (await request.get('/tracks/sitemap/0.xml')).text();

    const blocks = blocksOfTrack(xml, hot);
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block).toContain(
        `<image:image><image:loc>${hotCover}</image:loc></image:image>`,
      );
    }
  });

  test('lists no image for a Track without a cover, on either locale URL', async ({
    request,
  }) => {
    const xml = await (await request.get('/tracks/sitemap/0.xml')).text();

    const blocks = blocksOfTrack(xml, cold);
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block).not.toContain('<image:image>');
    }
  });

  test('answers 404 past its last file', async ({ request }) => {
    expect((await request.get('/tracks/sitemap/1.xml')).status()).toBe(404);
  });
});
