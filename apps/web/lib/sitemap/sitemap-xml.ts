import { routing } from '@/lib/i18n/routing';

/**
 * Shared sitemap XML builders used by every content type (pages, Tracks,
 * Albums, Artists, Users). Each URL is listed once per supported locale in
 * input order, pointing at all of its translations with hreflang plus an
 * x-default that targets the unprefixed path (which `proxy.ts` redirects to
 * the visitor's locale). `lastmod` comes from the record, priority and
 * changefreq from the content type, and image/video extensions ride along
 * wherever the source record exposes them.
 */

export type SitemapChangefreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export type SitemapImage = {
  /** Absolute URL of the image (cover art, Avatar, page image). */
  loc: string;
  title?: string;
  caption?: string;
};

export type SitemapVideo = {
  thumbnailLoc: string;
  title: string;
  description: string;
  contentLoc?: string;
  playerLoc?: string;
  /** Length in seconds. */
  duration?: number;
  /** Publication date as ISO 8601. */
  publicationDate?: string;
};

/**
 * Per-type SEO weight: home highest, catalog high, general pages in the
 * middle, auth entry points low (indexable by decision, but never promoted).
 */
export const sitemapContentMeta = {
  home: { priority: 1, changefreq: 'daily' },
  track: { priority: 0.8, changefreq: 'daily' },
  album: { priority: 0.7, changefreq: 'weekly' },
  artist: { priority: 0.7, changefreq: 'weekly' },
  user: { priority: 0.6, changefreq: 'weekly' },
  page: { priority: 0.7, changefreq: 'monthly' },
  auth: { priority: 0.3, changefreq: 'monthly' },
} as const satisfies Record<
  string,
  { priority: number; changefreq: SitemapChangefreq }
>;

export type SitemapContentType = keyof typeof sitemapContentMeta;

export type SitemapUrlEntry = {
  /** Unprefixed path (`/`, `/terms`, `/tracks/<id>`, `/users/<username>`). */
  path: string;
  /** The record's last change as ISO 8601. */
  updatedAt: string;
  type: SitemapContentType;
  images?: readonly SitemapImage[];
  videos?: readonly SitemapVideo[];
};

export type SitemapShardRef = {
  /** Unprefixed path of the shard file (`/sitemaps/tracks-0.xml`). */
  path: string;
  lastmod?: string;
};

const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const tag = (name: string, value: string | number): string =>
  `<${name}>${escapeXml(String(value))}</${name}>`;

/** `<name>value</name>`, or nothing when the optional value is absent. */
const optionalTag = (
  name: string,
  value: string | number | undefined,
): string => (value === undefined ? '' : tag(name, value));

/** Encodes each `/`-separated segment, keeping the slashes themselves. */
const encodeSitemapPath = (path: string): string =>
  path
    .split('/')
    .map((segment) => (segment === '' ? '' : encodeURIComponent(segment)))
    .join('/');

const withLeadingSlash = (path: string): string =>
  path.startsWith('/') ? path : `/${path}`;

const stripBaseSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * The locale URL of an already-encoded path. The home page keeps the
 * canonical shape (`/<locale>`, no trailing slash).
 */
const localeHref = (
  base: string,
  locale: string,
  encodedPath: string,
): string =>
  encodedPath === '/' ? `${base}/${locale}` : `${base}/${locale}${encodedPath}`;

const alternateLinks = (base: string, encodedPath: string): string => {
  const translations = routing.locales
    .map(
      (locale) =>
        `<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(localeHref(base, locale, encodedPath))}"/>`,
    )
    .join('');
  const fallback = `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${base}${encodedPath}`)}"/>`;
  return `${translations}${fallback}`;
};

const imageXml = (image: SitemapImage): string =>
  `<image:image>${tag('image:loc', image.loc)}${optionalTag('image:title', image.title)}${optionalTag('image:caption', image.caption)}</image:image>`;

const videoXml = (video: SitemapVideo): string =>
  '<video:video>' +
  tag('video:thumbnail_loc', video.thumbnailLoc) +
  tag('video:title', video.title) +
  tag('video:description', video.description) +
  optionalTag('video:content_loc', video.contentLoc) +
  optionalTag('video:player_loc', video.playerLoc) +
  optionalTag('video:duration', video.duration) +
  optionalTag('video:publication_date', video.publicationDate) +
  '</video:video>';

const mediaXml = (entry: SitemapUrlEntry): string => {
  const images = (entry.images ?? []).map(imageXml).join('');
  const videos = (entry.videos ?? []).map(videoXml).join('');
  return `${images}${videos}`;
};

const entryUrlsXml = (entry: SitemapUrlEntry, base: string): string => {
  const meta = sitemapContentMeta[entry.type];
  const encodedPath = encodeSitemapPath(withLeadingSlash(entry.path));
  const seo =
    tag('lastmod', entry.updatedAt) +
    tag('changefreq', meta.changefreq) +
    tag('priority', meta.priority.toFixed(1));
  const alternates = alternateLinks(base, encodedPath);
  const media = mediaXml(entry);
  return routing.locales
    .map(
      (locale) =>
        `<url>${tag('loc', localeHref(base, locale, encodedPath))}${seo}${alternates}${media}</url>`,
    )
    .join('');
};

const urlsetNamespaces = (entries: readonly SitemapUrlEntry[]): string => {
  const withImages = entries.some((entry) => (entry.images?.length ?? 0) > 0);
  const withVideos = entries.some((entry) => (entry.videos?.length ?? 0) > 0);
  return (
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:xhtml="http://www.w3.org/1999/xhtml"' +
    (withImages
      ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
      : '') +
    (withVideos
      ? ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"'
      : '')
  );
};

/**
 * A sitemap urlset for the given entries, in the order given. Image and
 * video namespaces are declared only when an entry actually carries them,
 * so media-free files keep the plain urlset shape.
 */
export function buildSitemapUrlset(
  entries: readonly SitemapUrlEntry[],
  siteUrl: string,
): string {
  const base = stripBaseSlash(siteUrl);
  const urls = entries.map((entry) => entryUrlsXml(entry, base)).join('');
  return `${xmlDeclaration}<urlset ${urlsetNamespaces(entries)}>${urls}</urlset>`;
}

/**
 * A sitemap index pointing at the given shard files with absolute URLs for
 * the requesting domain (`siteUrl` is that domain's origin).
 */
export function buildSitemapIndex(
  shards: readonly SitemapShardRef[],
  siteUrl: string,
): string {
  const base = stripBaseSlash(siteUrl);
  const items = shards
    .map((shard) => {
      const loc = `${base}${encodeSitemapPath(withLeadingSlash(shard.path))}`;
      return `<sitemap>${tag('loc', loc)}${optionalTag('lastmod', shard.lastmod)}</sitemap>`;
    })
    .join('');
  return `${xmlDeclaration}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}

const shardNamePattern = /^(\d{1,6})\.xml$/;

/**
 * The shard a numeric file name points at (`0.xml` is shard 0). Anything
 * else (missing numbers, signs, extra segments, other extensions) is
 * refused so unknown shard URLs fall through to not-found.
 */
export function parseSitemapShardName(name: string): number | undefined {
  const digits = shardNamePattern.exec(name)?.[1];
  if (digits === undefined) return undefined;
  return Number(digits);
}
