import { expect, test } from '@playwright/test';

// Listed in SITEMAP_EXTRA_HOSTS by e2e/web-server-env.ts (plain http, as the
// site URL is the default one).
const extraHost = 'vozzify.example';
const extraOrigin = `http://${extraHost}`;

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

test.describe('tracks sitemap host', () => {
  test('lists the URLs of the forwarded host, as every other file does', async ({
    request,
  }) => {
    const response = await request.get('/tracks/sitemap/0.xml', {
      headers: { 'x-forwarded-host': extraHost },
    });

    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml).toContain(
      `<loc>${extraOrigin}/en/tracks/clx-sitemap-hot</loc>`,
    );
    expect(xml).not.toContain('http://localhost:3000/en/tracks/');
  });
});
