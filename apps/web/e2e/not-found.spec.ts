import { expect, test } from '@playwright/test';

import { messages } from './messages';

const locales = [
  { locale: 'en', copy: messages.en.notFound, header: messages.en.header },
  {
    locale: 'pt-BR',
    copy: messages['pt-BR'].notFound,
    header: messages['pt-BR'].header,
  },
] as const;

const unknownPath = (locale: string) =>
  `/${locale}/this-page-does-not-exist-${locale}`;

const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1];

test.describe('not found page', () => {
  for (const { locale, copy, header } of locales) {
    test(`${locale}: unknown URL is a real 404 with translated copy in the server HTML`, async ({
      request,
    }) => {
      const response = await request.get(unknownPath(locale));
      const html = await response.text();

      expect(response.status()).toBe(404);
      expect(html).toContain(`lang="${locale}"`);
      expect(titleOf(html)).toBe(copy.metaTitle);
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.description);
    });

    test(`${locale}: the page heading reads 404 and the translated title`, async ({
      page,
    }) => {
      await page.goto(unknownPath(locale));

      await expect(
        page.getByRole('heading', { level: 1, name: copy.title }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        new RegExp(`404\\s*${copy.title}`),
      );
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    });

    test(`${locale}: is marked noindex with no canonical or alternates`, async ({
      request,
    }) => {
      const html = await (await request.get(unknownPath(locale))).text();

      expect(html).toMatch(/<meta name="robots" content="noindex"\/?>/);
      expect(html).not.toContain('rel="canonical"');
      expect(html).not.toContain('hrefLang=');
      expect(html).not.toContain('hreflang=');
    });

    test(`${locale}: keeps the site header and footer, and only one header`, async ({
      page,
    }) => {
      await page.goto(unknownPath(locale));

      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(
        page.getByRole('searchbox', { name: header.search.label }),
      ).toBeVisible();
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('contentinfo')).toHaveCount(1);
    });

    test(`${locale}: home and search links keep the locale`, async ({
      page,
    }) => {
      await page.goto(unknownPath(locale));

      await expect(
        page.getByRole('link', { name: copy.homeLabel }),
      ).toHaveAttribute('href', `/${locale}`);
      await expect(
        page.getByRole('link', { name: copy.searchLabel }),
      ).toHaveAttribute('href', `/${locale}/search`);
    });

    test(`${locale}: the search link opens search in the same locale`, async ({
      page,
    }) => {
      await page.goto(unknownPath(locale));

      await page.getByRole('link', { name: copy.searchLabel }).click();

      await expect(page).toHaveURL(`/${locale}/search`);
    });

    test(`${locale}: the home link returns to the home page`, async ({
      page,
    }) => {
      await page.goto(unknownPath(locale));

      await page.getByRole('link', { name: copy.homeLabel }).click();

      await expect(page).toHaveURL(`/${locale}`);
    });
  }

  test('an unprefixed unknown URL redirects to the locale before the 404', async ({
    request,
  }) => {
    const response = await request.get('/this-page-does-not-exist', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(
      /\/en\/this-page-does-not-exist$/,
    );
  });

  test('a path the proxy skips gets the English framework 404', async ({
    page,
  }) => {
    // `/api/...` is outside the proxy matcher, so no locale header is sent and
    // the fallback resolves to the `en` catalog.
    const response = await page.goto('/api/does-not-exist');

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { level: 1, name: messages.en.notFound.title }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: messages.en.notFound.homeLabel }),
    ).toHaveAttribute('href', '/en');
  });

  test('fits a 360px wide screen without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(unknownPath('en'));

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(
      page.getByRole('link', { name: messages.en.notFound.homeLabel }),
    ).toBeInViewport();
  });
});
