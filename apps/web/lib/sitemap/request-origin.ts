import { getSiteUrl } from '@/lib/env/client';
import { getServerEnv } from '@/lib/env/server';

/**
 * The origin a crawler-facing response is written for. The request's host
 * (the CDN forwards the public one) is used only when it is one of the
 * domains the sitemaps answer for: NEXT_PUBLIC_SITE_URL's host plus
 * SITEMAP_EXTRA_HOSTS. Any other host gets the site URL's origin, so an
 * unknown Host header never reaches a sitemap URL.
 *
 * The protocol always comes from the configured site URL, never from the
 * request: behind a proxy the request says `http` even for an https site.
 */
export function requestSiteOrigin(request: Request): string {
  const site = getSiteUrl();
  const host =
    firstValue(request.headers.get('x-forwarded-host')) ??
    firstValue(request.headers.get('host'));
  if (host === undefined) return site.origin;

  const requested = host.toLowerCase();
  const allowed = new Set([site.host, ...getServerEnv().SITEMAP_EXTRA_HOSTS]);
  return allowed.has(requested)
    ? `${site.protocol}//${requested}`
    : site.origin;
}

/** The first entry of a comma-separated header such as `a.example, proxy`. */
function firstValue(header: string | null): string | undefined {
  const value = header?.split(',')[0]?.trim();
  return value === undefined || value === '' ? undefined : value;
}
