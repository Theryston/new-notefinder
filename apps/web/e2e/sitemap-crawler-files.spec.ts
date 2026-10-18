import { expect, test } from '@playwright/test';

// Every file a crawler reads from the new app's domain. The legacy shard URLs
// are checked in legacy-routes.spec.ts; these are the ones that must answer
// the same way on every file: 200, cacheable per host, Vary on the host.
const crawlerFiles = [
  '/sitemap.xml',
  '/robots.txt',
  '/pages/sitemap/0.xml',
  '/tracks/sitemap/0.xml',
  '/albums/sitemap/0.xml',
  '/artists/sitemap/0.xml',
  '/users/sitemap/0.xml',
];

test.describe('crawler files cache per host on every file', () => {
  for (const path of crawlerFiles) {
    test(`${path} answers 200 with a shared cache and the host Vary`, async ({
      request,
    }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toMatch(/s-maxage=\d+/);
      expect(response.headers().vary).toContain('X-Forwarded-Host, Host');
    });
  }
});
