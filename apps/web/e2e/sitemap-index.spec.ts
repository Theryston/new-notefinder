import { expect, test } from '@playwright/test';

const localOrigin = 'http://localhost:3000';
const publicHost = 'notefinder.example';

const contentSitemaps = [
  '/pages/sitemap/0.xml',
  '/tracks/sitemap/0.xml',
  '/albums/sitemap/0.xml',
  '/artists/sitemap/0.xml',
  '/users/sitemap/0.xml',
];

/** Every `<loc>` in a document, in order. */
const locsOf = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? '');

/**
 * A light well-formedness check: the document opens and closes its root
 * element, and each `<url>` / `<sitemap>` entry is closed exactly once.
 */
const expectWellFormedUrlset = (xml: string, entry: 'url' | 'sitemap') => {
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  const opened = xml.split(`<${entry}>`).length - 1;
  const closed = xml.split(`</${entry}>`).length - 1;
  expect(opened).toBe(closed);
  expect(opened).toBeGreaterThan(0);
};

test.describe('sitemap index', () => {
  test('lists the five content sitemaps at the requesting host', async ({
    request,
  }) => {
    const response = await request.get('/sitemap.xml', { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/xml');
    expect(response.headers()['cache-control']).toContain('s-maxage=');
    const xml = await response.text();
    expectWellFormedUrlset(xml, 'sitemap');
    expect(locsOf(xml)).toEqual(
      contentSitemaps.map((path) => `${localOrigin}${path}`),
    );
  });

  test('takes the host from the forwarded headers the CDN sends', async ({
    request,
  }) => {
    const response = await request.get('/sitemap.xml', {
      headers: {
        'x-forwarded-host': publicHost,
        'x-forwarded-proto': 'https',
      },
    });

    expect(response.status()).toBe(200);
    expect(locsOf(await response.text())).toEqual(
      contentSitemaps.map((path) => `https://${publicHost}${path}`),
    );
  });
});

test.describe('general pages shard', () => {
  test('lists home, terms and the auth pages in both locales with hreflang', async ({
    request,
  }) => {
    const response = await request.get('/pages/sitemap/0.xml', {
      headers: { 'x-forwarded-host': publicHost, 'x-forwarded-proto': 'https' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/xml');
    const xml = await response.text();
    expectWellFormedUrlset(xml, 'url');
    const base = `https://${publicHost}`;
    expect(locsOf(xml)).toEqual([
      `${base}/en`,
      `${base}/pt-BR`,
      `${base}/en/terms`,
      `${base}/pt-BR/terms`,
      `${base}/en/sign-in`,
      `${base}/pt-BR/sign-in`,
      `${base}/en/sign-up`,
      `${base}/pt-BR/sign-up`,
    ]);
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="pt-BR" href="${base}/pt-BR/terms"/>`,
    );
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${base}/terms"/>`,
    );
  });

  test('answers 404 past its only file', async ({ request }) => {
    expect((await request.get('/pages/sitemap/1.xml')).status()).toBe(404);
  });
});

test.describe('robots.txt', () => {
  test('references the index of the requesting host', async ({ request }) => {
    const response = await request.get('/robots.txt', { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(await response.text()).toContain(
      `Sitemap: ${localOrigin}/sitemap.xml`,
    );
  });

  test('is not redirected to a locale', async ({ request }) => {
    const response = await request.get('/robots.txt', {
      headers: { 'cf-ipcountry': 'BR' },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);
  });
});
