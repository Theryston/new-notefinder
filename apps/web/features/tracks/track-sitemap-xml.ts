import type { TrackSitemapEntry } from '@notefinder/contracts';

import { routing } from '@/lib/i18n/routing';

/** How many Tracks one sitemap file lists (a file may hold 50,000 URLs). */
export const TRACK_SITEMAP_PAGE_SIZE = 5000;

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

/**
 * The sitemap file for a page of Tracks, in the order given (the API sends
 * the highest trending score first). Each Track is listed once per locale,
 * each URL pointing to all of its translations.
 */
export function trackSitemapXml(
  entries: readonly TrackSitemapEntry[],
  siteUrl: string,
): string {
  const base = siteUrl.replace(/\/+$/, '');
  const urls = entries.flatMap((entry) => {
    const href = (locale: string) =>
      escapeXml(`${base}/${locale}/tracks/${encodeURIComponent(entry.id)}`);
    const alternates = routing.locales
      .map(
        (locale) =>
          `<xhtml:link rel="alternate" hreflang="${locale}" href="${href(locale)}"/>`,
      )
      .join('');
    return routing.locales.map(
      (locale) =>
        `<url><loc>${href(locale)}</loc><lastmod>${escapeXml(entry.updatedAt)}</lastmod>${alternates}</url>`,
    );
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    urls.join('') +
    '</urlset>'
  );
}

/** The page index a legacy-style sitemap path names (`0.xml` is page 0). */
export function sitemapPageIndex(path: readonly string[]): number | undefined {
  const match =
    path.length === 1 ? /^(\d{1,6})\.xml$/.exec(path[0] ?? '') : null;
  return match?.[1] === undefined ? undefined : Number(match[1]);
}
