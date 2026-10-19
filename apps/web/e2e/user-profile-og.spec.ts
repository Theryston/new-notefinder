import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

// The preview image of a Profile, against the fake API (`fake-user-profile.ts`):
// the page's Open Graph and Twitter tags point at it, the image is a PNG of
// the card's size, and an unknown or failing Profile has no preview.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

/** The `og:image` URL the page of `path` declares (Next adds a hash to it). */
async function previewUrlOf(
  request: APIRequestContext,
  path: string,
): Promise<string> {
  const html = await (await request.get(path)).text();
  const url = /property="og:image" content="([^"]+)"/.exec(html)?.[1];
  if (url === undefined) {
    throw new Error(`no og:image on ${path}`);
  }
  return url;
}

test.describe('public profile preview image', () => {
  for (const locale of ['en', 'pt-BR']) {
    test(`the ${locale} page points its Open Graph and Twitter tags at the ${locale} image`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/users/ada_lovelace`);

      const ogImage = await page
        .locator('meta[property="og:image"]')
        .getAttribute('content');
      const twitterImage = await page
        .locator('meta[name="twitter:image"]')
        .getAttribute('content');

      // Absolute URLs on the site's origin, under this page's locale.
      for (const url of [ogImage, twitterImage]) {
        expect(url).toBeTruthy();
        const parsed = new URL(url ?? '');
        expect(parsed.protocol).toMatch(/^https?:$/);
        expect(parsed.pathname).toMatch(
          new RegExp(`^/${locale}/users/ada_lovelace/opengraph-image`),
        );
      }
      expect(twitterImage).toBe(ogImage);

      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image',
      );
    });
  }

  test('serves the card as a 1200x630 PNG', async ({ request }) => {
    const imageUrl = await previewUrlOf(request, '/en/users/ada_lovelace');

    const response = await request.get(imageUrl);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
    const bytes = await response.body();
    expect([...bytes.subarray(0, 4)]).toEqual(PNG_SIGNATURE);
    // IHDR holds the width and height as 4-byte big-endian numbers.
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  });

  test('has no preview for an unknown username', async ({ request }) => {
    const adaImage = await previewUrlOf(request, '/en/users/ada_lovelace');
    const response = await request.get(
      adaImage.replace('/users/ada_lovelace/', '/users/nobody/'),
    );

    expect(response.status()).toBe(404);
    expect(await response.text()).toBe('Not found');
  });

  test('has no preview when the API fails for the username', async ({
    request,
  }) => {
    const adaImage = await previewUrlOf(request, '/en/users/ada_lovelace');
    const response = await request.get(
      adaImage.replace('/users/ada_lovelace/', '/users/broken/'),
    );

    expect(response.status()).toBe(404);
    expect(await response.text()).toBe('Not found');
  });
});
