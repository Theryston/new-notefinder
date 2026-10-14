import { trackSitemapSchema } from '@notefinder/contracts';
import { serverApi } from '@/lib/api/server';
import { getSiteUrl } from '@/lib/env/client';
import { routing } from '@/lib/i18n/routing';

const xmlEscape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/** Public XML sitemap ordered by the API's trending score. */
export async function GET() {
  const { trackIds } = await serverApi('/tracks/sitemap.xml', {
    schema: trackSitemapSchema,
  });
  const siteUrl = getSiteUrl();
  const urls = trackIds
    .map(
      (trackId) =>
        `  <url><loc>${xmlEscape(new URL(`/${routing.defaultLocale}/tracks/${encodeURIComponent(trackId)}`, siteUrl).toString())}</loc></url>`,
    )
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
