/**
 * robots.txt for a domain: everything crawlable, and the absolute URL of
 * that domain's sitemap index, so crawlers find every sitemap without a
 * manual submission.
 */
export function robotsTxt(siteUrl: string): string {
  const index = new URL('/sitemap.xml', siteUrl).href;
  return `User-agent: *\nAllow: /\n\nSitemap: ${index}\n`;
}
