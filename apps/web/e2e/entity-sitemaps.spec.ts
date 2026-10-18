import { type APIResponse, expect, type Page, test } from '@playwright/test';

const localOrigin = 'http://localhost:3000';
// Listed in SITEMAP_EXTRA_HOSTS by e2e/web-server-env.ts (plain http, as the
// site URL is the default one).
const extraHost = 'notefinder.example';
const extraOrigin = `http://${extraHost}`;

const sitemapNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const updatedAt = '2026-10-14T12:00:00.000Z';

/**
 * The fake API lists these in ID order and caps a page at two, so the three
 * sitemap files hold two, two and then two more (the last page exactly full).
 */
const fixtures = [
  {
    type: 'albums',
    ids: [1, 2, 3, 4, 5, 6].map((n) => `clx-sitemap-album-${n}`),
    priority: '0.7',
  },
  {
    type: 'artists',
    ids: [1, 2, 3, 4, 5].map((n) => `clx-sitemap-artist-${n}`),
    priority: '0.7',
  },
] as const;

type EntityType = (typeof fixtures)[number]['type'];

type ParsedUrl = {
  loc: string | undefined;
  lastmod: string | undefined;
  changefreq: string | undefined;
  priority: string | undefined;
  alternates: string[];
};

/**
 * Parses the document with the browser's XML parser, the way a crawler's
 * would: a malformed file reports a parser error instead of passing a string
 * match. `urls` are the `<url>` elements in document order.
 */
const parseUrls = (page: Page, xml: string) =>
  page.evaluate(
    ({ source, namespace }) => {
      const doc = new DOMParser().parseFromString(source, 'application/xml');
      const text = (url: Element, name: string) =>
        url.getElementsByTagNameNS(namespace, name)[0]?.textContent;
      const urls: ParsedUrl[] = Array.from(
        doc.getElementsByTagNameNS(namespace, 'url'),
        (url) => ({
          loc: text(url, 'loc'),
          lastmod: text(url, 'lastmod'),
          changefreq: text(url, 'changefreq'),
          priority: text(url, 'priority'),
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

/** The URLs one entity contributes: each locale, with all its alternates. */
const urlsFor = (
  origin: string,
  type: EntityType,
  priority: string,
  ids: readonly string[],
): ParsedUrl[] =>
  ids.flatMap((id) => {
    const path = `/${type}/${id}`;
    return ['en', 'pt-BR'].map((locale) => ({
      loc: `${origin}/${locale}${path}`,
      lastmod: updatedAt,
      changefreq: 'weekly',
      priority,
      alternates: [
        `en ${origin}/en${path}`,
        `pt-BR ${origin}/pt-BR${path}`,
        `x-default ${origin}${path}`,
      ],
    }));
  });

/** The IDs one sitemap file holds: two per file, in order. */
const idsOfFile = (ids: readonly string[], index: number) =>
  ids.slice(index * 2, index * 2 + 2);

const expectXmlHeaders = (response: APIResponse) => {
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/xml');
  expect(response.headers()['cache-control']).toContain('s-maxage=3600');
  expect(response.headers().vary).toContain('X-Forwarded-Host, Host');
};

for (const fixture of fixtures) {
  const { type, ids, priority } = fixture;

  test.describe(`${type} sitemap`, () => {
    test('lists the first file with lastmod, changefreq, priority and both locales', async ({
      page,
      request,
    }) => {
      const response = await request.get(`/${type}/sitemap/0.xml`, {
        headers: { 'x-forwarded-host': extraHost },
      });

      expectXmlHeaders(response);
      const parsed = await parseUrls(page, await response.text());
      expect(parsed.parseErrors).toBe(0);
      expect(parsed.root).toBe('urlset');
      expect(parsed.urls).toEqual(
        urlsFor(extraOrigin, type, priority, idsOfFile(ids, 0)),
      );
    });

    test('walks the cursors into later files, each entity once and in order', async ({
      page,
      request,
    }) => {
      const listed: string[] = [];
      for (const index of [0, 1, 2]) {
        const response = await request.get(`/${type}/sitemap/${index}.xml`);

        expectXmlHeaders(response);
        const parsed = await parseUrls(page, await response.text());
        expect(parsed.parseErrors).toBe(0);
        expect(parsed.urls).toEqual(
          urlsFor(localOrigin, type, priority, idsOfFile(ids, index)),
        );
        listed.push(...idsOfFile(ids, index));
      }
      // The three files together list every entity exactly once.
      expect(listed).toEqual(ids);
      expect(new Set(listed).size).toBe(ids.length);
    });

    test('answers 404 past the last file and for a path that is not a file', async ({
      request,
    }) => {
      // Two per file: the files are 0 to ceil(n / 2) - 1, and the one after
      // the last (the listing has no next cursor past an exactly full page)
      // does not exist.
      const pastLast = Math.ceil(ids.length / 2);
      expect(
        (await request.get(`/${type}/sitemap/${pastLast}.xml`)).status(),
      ).toBe(404);
      expect((await request.get(`/${type}/sitemap/nope.xml`)).status()).toBe(
        404,
      );
    });
  });
}
