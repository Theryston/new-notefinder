import { expect, test } from '@playwright/test';

const localOrigin = 'http://localhost:3000';

// The fake API's Tracks listing (fake-track-sitemap.ts): completed Tracks
// only, the most viewed first. The processing one must never be listed.
const hot = 'clx-sitemap-hot';
const cold = 'clx-sitemap-cold';

const locsOf = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? '');

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

  test('answers 404 past its last file', async ({ request }) => {
    expect((await request.get('/tracks/sitemap/1.xml')).status()).toBe(404);
  });
});
