import { getSiteUrl } from '@/lib/env/client';

/**
 * The origin a crawler-facing response is written for: the host the request
 * came in on, so one deploy serves every domain with its own absolute URLs
 * (the CDN forwards the public host). Without a usable host, the configured
 * public site URL is the answer.
 */
export function requestSiteOrigin(request: Request): string {
  const host =
    firstValue(request.headers.get('x-forwarded-host')) ??
    firstValue(request.headers.get('host'));
  const origin =
    host === undefined
      ? undefined
      : originForHost(host, forwardedProtocol(request));
  return origin ?? getSiteUrl().origin;
}

/** The first entry of a comma-separated header such as `a.example, proxy`. */
function firstValue(header: string | null): string | undefined {
  const value = header?.split(',')[0]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function forwardedProtocol(request: Request): 'http' | 'https' {
  const forwarded = firstValue(
    request.headers.get('x-forwarded-proto'),
  )?.toLowerCase();
  if (forwarded === 'http' || forwarded === 'https') return forwarded;
  return new URL(request.url).protocol === 'http:' ? 'http' : 'https';
}

/**
 * The origin for a bare `host[:port]`. A value that carries a path, a query,
 * a fragment or credentials is refused: it cannot be a domain, and echoing it
 * into sitemap URLs would be wrong.
 */
function originForHost(host: string, protocol: string): string | undefined {
  let url: URL;
  try {
    url = new URL(`${protocol}://${host}`);
  } catch {
    return undefined;
  }
  const isBareHost =
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '' &&
    url.username === '' &&
    url.password === '';
  return isBareHost ? url.origin : undefined;
}
