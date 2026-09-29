import { expect, test } from '@playwright/test';

const BRAND_ORANGE = '#FA4900';

test.describe('app icons', () => {
  test('the head links the favicon, the SVG icon and the Apple icon', async ({
    page,
  }) => {
    await page.goto('/en');

    const links = await page
      .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          rel: element.getAttribute('rel'),
          type: element.getAttribute('type'),
          sizes: element.getAttribute('sizes'),
          path: new URL(element.getAttribute('href') ?? '', location.href)
            .pathname,
        })),
      );

    expect(links).toEqual([
      {
        rel: 'icon',
        type: 'image/x-icon',
        sizes: expect.any(String),
        path: '/favicon.ico',
      },
      { rel: 'icon', type: 'image/svg+xml', sizes: 'any', path: '/icon.svg' },
      {
        rel: 'apple-touch-icon',
        type: 'image/png',
        sizes: '180x180',
        path: '/apple-icon.png',
      },
    ]);
  });

  for (const [path, contentType] of [
    ['/favicon.ico', 'image/x-icon'],
    ['/icon.svg', 'image/svg+xml'],
    ['/apple-icon.png', 'image/png'],
  ] as const) {
    // Served from the root: the locale redirect must not catch them.
    test(`${path} is served without a locale redirect`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain(contentType);
    });
  }

  test('the SVG icon is drawn in the brand orange', async ({ request }) => {
    const response = await request.get('/icon.svg');

    expect(await response.text()).toContain(BRAND_ORANGE);
  });
});
