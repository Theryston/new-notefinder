import { expect, type Page, test } from '@playwright/test';

// Listed in SITEMAP_EXTRA_HOSTS by e2e/web-server-env.ts.
const extraHost = 'notefinder.example';
const extraOrigin = `http://${extraHost}`;

const sitemapNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';

/**
 * Parses the document with the browser's XML parser, the way a crawler would:
 * a malformed file reports a parser error instead of passing a string match.
 */
const parseSitemap = (page: Page, xml: string) =>
  page.evaluate(
    ({ source, namespace }) => {
      const doc = new DOMParser().parseFromString(source, 'application/xml');
      return {
        parseErrors: doc.getElementsByTagName('parsererror').length,
        root: doc.documentElement.localName,
        namespace: doc.documentElement.namespaceURI,
        locs: Array.from(
          doc.getElementsByTagNameNS(namespace, 'loc'),
          (element) => element.textContent ?? '',
        ),
      };
    },
    { source: xml, namespace: sitemapNamespace },
  );

test.describe('users sitemap', () => {
  test('lists each Profile in both locales by its Username, with hreflang', async ({
    page,
    request,
  }) => {
    const response = await request.get('/users/sitemap/0.xml', {
      headers: { 'x-forwarded-host': extraHost },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/xml');
    expect(response.headers().vary).toContain('X-Forwarded-Host, Host');
    const xml = await response.text();
    const parsed = await parseSitemap(page, xml);
    expect(parsed.parseErrors).toBe(0);
    expect(parsed.root).toBe('urlset');
    expect(parsed.namespace).toBe(sitemapNamespace);
    expect(parsed.locs).toEqual([
      `${extraOrigin}/en/users/ada_lovelace`,
      `${extraOrigin}/pt-BR/users/ada_lovelace`,
      `${extraOrigin}/en/users/grace`,
      `${extraOrigin}/pt-BR/users/grace`,
    ]);
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="pt-BR" href="${extraOrigin}/pt-BR/users/grace"/>`,
    );
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${extraOrigin}/users/grace"/>`,
    );
  });

  test('answers 404 past its only file', async ({ request }) => {
    expect((await request.get('/users/sitemap/1.xml')).status()).toBe(404);
  });

  test('is not redirected to a locale for a visitor from Brazil', async ({
    request,
  }) => {
    const response = await request.get('/users/sitemap/0.xml', {
      headers: { 'cf-ipcountry': 'BR' },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);
    expect(response.headers().location).toBeUndefined();
  });
});
