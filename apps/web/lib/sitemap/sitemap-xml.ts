import { localizedPath } from '@/lib/i18n/metadata';
import { routing } from '@/lib/i18n/routing';

/**
 * Shared sitemap XML builders used by every content type (pages, Tracks,
 * Albums, Artists, Users). Each URL is listed once per supported locale in
 * input order, pointing at all of its translations with hreflang plus an
 * x-default for the unprefixed path (which `proxy.ts` redirects to the
 * visitor's locale). Locale paths come from `localizedPath`, the same helper
 * the pages' metadata uses, so the URL shape lives in one place.
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

/** Google needs a player or a content location, so at least one is typed in. */
type SitemapVideoSource =
  | { contentLoc: string; playerLoc?: string }
  | { contentLoc?: string; playerLoc: string };

export type SitemapVideo = SitemapVideoSource & {
  thumbnailLoc: string;
  title: string;
  description: string;
  /** Length in seconds; rounded, and omitted when outside Google's range. */
  duration?: number;
  /** Publication date as ISO 8601. */
  publicationDate?: string;
};

/**
 * Per-type SEO weight. Home is highest, catalog (Tracks, Albums, Artists)
 * above general pages, and auth entry points lowest: indexable by decision,
 * but never promoted over the content.
 */
export const sitemapContentMeta = {
  home: { priority: 1, changefreq: 'daily' },
  track: { priority: 0.8, changefreq: 'daily' },
  album: { priority: 0.7, changefreq: 'weekly' },
  artist: { priority: 0.7, changefreq: 'weekly' },
  user: { priority: 0.6, changefreq: 'weekly' },
  page: { priority: 0.6, changefreq: 'monthly' },
  auth: { priority: 0.3, changefreq: 'monthly' },
} as const satisfies Record<
  string,
  { priority: number; changefreq: SitemapChangefreq }
>;

export type SitemapContentType = keyof typeof sitemapContentMeta;

export type SitemapUrlEntry = {
  /**
   * Raw, unencoded path segments without the locale: `[]` for home,
   * `['tracks', id]` for a Track. Each segment is encoded once by the builder,
   * so a `/` or `?` inside an ID or Username stays part of that segment.
   */
  segments: readonly string[];
  /** The record's last change as ISO 8601. */
  updatedAt: string;
  type: SitemapContentType;
  images?: readonly SitemapImage[];
  videos?: readonly SitemapVideo[];
};

export type SitemapShardRef = {
  /** Raw segments of the shard file, e.g. `['tracks', 'sitemap', '0.xml']`. */
  segments: readonly string[];
  lastmod?: string;
};

const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
const sitemapNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';

/** Google's upper bound for `video:duration`: eight hours. */
const maxVideoDurationSeconds = 28_800;

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const tag = (name: string, value: string | number): string =>
  `<${name}>${escapeXml(String(value))}</${name}>`;

/** Absent optional values drop the whole element, not an empty one. */
const optionalTag = (
  name: string,
  value: string | number | undefined,
): string => (value === undefined ? '' : tag(name, value));

/**
 * The pathname for raw segments. Each segment is encoded on its own, so the
 * slashes between segments are the only `/`s in the result.
 */
const encodePathname = (segments: readonly string[]): string =>
  segments.length === 0
    ? '/'
    : `/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;

const stripTrailingSlashes = (url: string): string => url.replace(/\/+$/, '');

const alternate = (hreflang: string, href: string): string =>
  `<xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`;

const alternateLinks = (base: string, pathname: string): string =>
  routing.locales
    .map((locale) => alternate(locale, base + localizedPath(locale, pathname)))
    .join('') + alternate('x-default', base + pathname);

const imageXml = (image: SitemapImage): string =>
  `<image:image>${tag('image:loc', image.loc)}${optionalTag('image:title', image.title)}${optionalTag('image:caption', image.caption)}</image:image>`;

/**
 * Google accepts whole seconds from 1 to 28800. A value outside that range
 * is left out rather than sent wrong.
 */
const videoDurationSeconds = (
  duration: number | undefined,
): number | undefined => {
  if (duration === undefined) return undefined;
  const seconds = Math.round(duration);
  return Number.isFinite(seconds) &&
    seconds >= 1 &&
    seconds <= maxVideoDurationSeconds
    ? seconds
    : undefined;
};

const videoXml = (video: SitemapVideo): string =>
  '<video:video>' +
  tag('video:thumbnail_loc', video.thumbnailLoc) +
  tag('video:title', video.title) +
  tag('video:description', video.description) +
  optionalTag('video:content_loc', video.contentLoc) +
  optionalTag('video:player_loc', video.playerLoc) +
  optionalTag('video:duration', videoDurationSeconds(video.duration)) +
  optionalTag('video:publication_date', video.publicationDate) +
  '</video:video>';

const mediaXml = (entry: SitemapUrlEntry): string => {
  const images = (entry.images ?? []).map(imageXml).join('');
  const videos = (entry.videos ?? []).map(videoXml).join('');
  return `${images}${videos}`;
};

const entryUrlsXml = (entry: SitemapUrlEntry, base: string): string => {
  const meta = sitemapContentMeta[entry.type];
  const pathname = encodePathname(entry.segments);
  const urlMeta =
    tag('lastmod', entry.updatedAt) +
    tag('changefreq', meta.changefreq) +
    tag('priority', meta.priority.toFixed(1));
  const alternates = alternateLinks(base, pathname);
  const media = mediaXml(entry);
  return routing.locales
    .map(
      (locale) =>
        `<url>${tag('loc', base + localizedPath(locale, pathname))}${urlMeta}${alternates}${media}</url>`,
    )
    .join('');
};

const urlsetNamespaces = (entries: readonly SitemapUrlEntry[]): string => {
  const withImages = entries.some((entry) => (entry.images?.length ?? 0) > 0);
  const withVideos = entries.some((entry) => (entry.videos?.length ?? 0) > 0);
  return (
    `xmlns="${sitemapNamespace}" ` +
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
  const base = stripTrailingSlashes(siteUrl);
  const urls = entries.map((entry) => entryUrlsXml(entry, base)).join('');
  return `${xmlDeclaration}<urlset ${urlsetNamespaces(entries)}>${urls}</urlset>`;
}

/**
 * A sitemap index pointing at the given shard files, with absolute URLs for
 * the requesting domain (`siteUrl` is that domain's origin).
 */
export function buildSitemapIndex(
  shards: readonly SitemapShardRef[],
  siteUrl: string,
): string {
  const base = stripTrailingSlashes(siteUrl);
  const items = shards
    .map(
      (shard) =>
        `<sitemap>${tag('loc', base + encodePathname(shard.segments))}${optionalTag('lastmod', shard.lastmod)}</sitemap>`,
    )
    .join('');
  return `${xmlDeclaration}<sitemapindex xmlns="${sitemapNamespace}">${items}</sitemapindex>`;
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
