/**
 * Cache-Control of a complete crawler-facing file: the CDN may share it per
 * host for a few hours, and serve a stale copy while a fresh one is made.
 */
export const fullCacheControl =
  'public, s-maxage=3600, stale-while-revalidate=86400';

/**
 * Cache-Control of a file answered from a failed upstream read. It is short so
 * the CDN drops the thin file within a minute, and the full one comes back
 * soon, instead of an empty list being kept for hours.
 */
export const partialCacheControl = 'public, s-maxage=60';

/**
 * A crawler-facing file (sitemap, index, robots). The response depends on the
 * requested host, so `Vary` names the headers the host comes from, and a
 * shared cache never answers one host with another's URLs.
 */
export function crawlerResponse(
  body: string,
  contentType: string,
  cacheControl: string = fullCacheControl,
): Response {
  return new Response(body, {
    headers: {
      'content-type': contentType,
      'cache-control': cacheControl,
      vary: 'X-Forwarded-Host, Host',
    },
  });
}

export const xmlContentType = 'application/xml; charset=utf-8';
export const textContentType = 'text/plain; charset=utf-8';
