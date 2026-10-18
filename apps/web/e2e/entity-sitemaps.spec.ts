import { expect, type Page, test } from '@playwright/test';

const localOrigin = 'http://localhost:3000';
// Listed in SITEMAP_EXTRA_HOSTS by e2e/web-server-env.ts (plain http, as the
// site URL is the default one).
const extraHost = 'notefinder.example';
const extraOrigin = `http://${extraHost}`;

const sitemapNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';

/**
 * Parses the document with the browser's XML parser, the way a crawler's
 * would: a malformed file reports a parser error instead of passing a string
 * match. `urls` are the `<url>` elements in document order.
 */
const parseUrls = (page: Page, xml: string) =>
  page.evaluate(
    ({ source, namespace }) => {
      const doc = new DOMParser().parseFromString(source, 'application/xml');
      const urls = Array.from(
        doc.getElementsByTagNameNS(namespace, 'url'),
        (url) => ({
          loc: url.getElementsByTagNameNS(namespace, 'loc')[0]?.textContent,
          lastmod: url.getElementsByTagNameNS(namespace, 'lastmod')[0]
            ?.textContent,
          changefreq: url.getElementsByTagNameNS(namespace, 'changefreq')[0]
            ?.textContent,
          priority: url.getElementsByTagNameNS(namespace, 'priority')[0]
            ?.textContent,
          alternates: Array.from(
            url.getElementsByTagName('xhtml:link'),
            (link) =>
              `${link.getAttribute('hreflang')} ${link.getAttribute('href')}`,
          ),
        }),
      );
      return {
        parseErrors: doc.getElementsByTagName('parsererror').length,
        root: doc.documentElement.localName,
        urls,
      };
    },
    { source: xml, namespace: sitemapNamespace },
  );

const updatedAt = '2026-10-14T12:00:00.000Z';

test.describe('albums sitemap', () => {
  test('lists each Album in both locales, with hreflang, lastmod and priority', async ({
    page,
    request,
  }) => {
    const response = await request.get('/albums/sitemap/0.xml', {
      headers: { 'x-forwarded-host': extraHost },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/xml');
    expect(response.headers()['cache-control']).toContain('s-maxage=');
    expect(response.headers().vary).toContain('X-Forwarded-Host, Host');
    const parsed = await parseUrls(page, await response.text());
    expect(parsed.parseErrors).toBe(0);
    expect(parsed.root).toBe('urlset');
    expect(parsed.urls).toEqual(
      ['clx-sitemap-album-b', 'clx-sitemap-album-a'].flatMap((id) =>
        ['en', 'pt-BR'].map((locale) => ({
          loc: `${extraOrigin}/${locale}/albums/${id}`,
          lastmod: updatedAt,
          changefreq: 'weekly',
          priority: '0.7',
          alternates: [
            `en ${extraOrigin}/en/albums/${id}`,
            `pt-BR ${extraOrigin}/pt-BR/albums/${id}`,
            `x-default ${extraOrigin}/albums/${id}`,
          ],
        })),
      ),
    );
  });

  test('answers 404 past its only file', async ({ request }) => {
    expect((await request.get('/albums/sitemap/1.xml')).status()).toBe(404);
  });
});

test.describe('artists sitemap', () => {
  test('lists each Artist at the requesting host, in both locales', async ({
    page,
    request,
  }) => {
    const response = await request.get('/artists/sitemap/0.xml');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/xml');
    expect(response.headers().vary).toContain('X-Forwarded-Host, Host');
    const parsed = await parseUrls(page, await response.text());
    expect(parsed.parseErrors).toBe(0);
    expect(parsed.urls.map((url) => url.loc)).toEqual([
      `${localOrigin}/en/artists/clx-sitemap-artist-a`,
      `${localOrigin}/pt-BR/artists/clx-sitemap-artist-a`,
    ]);
    expect(parsed.urls[0]?.priority).toBe('0.7');
  });

  test('answers 404 past its only file and for a path that is not a file', async ({
    request,
  }) => {
    expect((await request.get('/artists/sitemap/1.xml')).status()).toBe(404);
    expect((await request.get('/artists/sitemap/nope.xml')).status()).toBe(404);
  });
});
