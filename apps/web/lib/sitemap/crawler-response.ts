/**
 * A crawler-facing file (sitemap, index, robots). The response depends on the
 * requested host, so the CDN may share it per host for a few hours, and
 * serve a stale copy while a fresh one is made. `Vary` names the headers the
 * host comes from, so a shared cache never answers one host with another's
 * URLs.
 */
export function crawlerResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      vary: 'X-Forwarded-Host, Host',
    },
  });
}

export const xmlContentType = 'application/xml; charset=utf-8';
export const textContentType = 'text/plain; charset=utf-8';
