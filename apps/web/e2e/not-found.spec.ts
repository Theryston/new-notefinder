import { expect, test } from '@playwright/test';

import { messages } from './messages';

const locales = [
  { locale: 'en', copy: messages.en.notFound },
  { locale: 'pt-BR', copy: messages['pt-BR'].notFound },
] as const;

const unknownPath = (locale: string) =>
  `/${locale}/this-page-does-not-exist-${locale}`;

test.describe('not found page', () => {
  for (const { locale, copy } of locales) {
    test(`${locale}: unknown URL is a real 404 that is noindex with no canonical`, async ({
      request,
    }) => {
      const response = await request.get(unknownPath(locale));
      const html = await response.text();

      expect(response.status()).toBe(404);
      expect(html).toMatch(/<meta name="robots" content="noindex"/);
      expect(html).not.toContain('rel="canonical"');
      expect(html).not.toContain('hreflang=');
    });

    test(`${locale}: shows the site header once, the translated heading and both links`, async ({
      page,
    }) => {
      const response = await page.goto(unknownPath(locale));

      expect(response?.status()).toBe(404);
      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(
        page.getByRole('heading', { level: 1, name: `404 ${copy.title}` }),
      ).toBeVisible();
      await expect(page.getByText(copy.description)).toBeVisible();
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
      const searchLink = page.getByRole('link', { name: copy.searchLabel });
      await expect(searchLink).toBeVisible();

      await searchLink.click();

      await expect(page).toHaveURL(`/${locale}/search`);
    });
  }

  test('fits a 360px wide screen without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(unknownPath('en'));

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
