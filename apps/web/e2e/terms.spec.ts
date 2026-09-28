import { expect, test } from '@playwright/test';

import { messages } from './messages';

const ISSUES_URL = 'https://github.com/Theryston/notefinder/issues';

// The order the terms are numbered in (and the legacy page used).
const sectionOrder = [
  'acceptance',
  'service',
  'copyright',
  'acceptableUse',
  'accounts',
  'privacy',
  'liability',
  'accuracy',
  'serviceChanges',
  'termsChanges',
  'thirdParties',
  'governingLaw',
  'contact',
  'general',
] as const;

const locales = [
  { locale: 'en', terms: messages.en.terms, updated: 'October 31, 2025' },
  {
    locale: 'pt-BR',
    terms: messages['pt-BR'].terms,
    updated: '31 de outubro de 2025',
  },
] as const;

test.describe('terms page', () => {
  for (const { locale, terms, updated } of locales) {
    test(`/${locale}/terms shows the numbered terms in ${locale}`, async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/terms`);
      expect(response?.status()).toBe(200);

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page).toHaveTitle(`${terms.metaTitle} | NoteFinder`);
      await expect(
        page.getByRole('heading', { level: 1, name: terms.title }),
      ).toBeVisible();
      await expect(page.getByRole('main')).toContainText(
        terms.lastUpdated.replace('<time>{date}</time>', updated),
      );

      // Every section, in order, numbered from 1, and nothing else.
      const headings = sectionOrder.map(
        (id, index) => `${index + 1}. ${terms.sections[id].title}`,
      );
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(
        headings,
      );
      await expect(page.getByRole('heading', { level: 2 })).toHaveCount(
        Object.keys(terms.sections).length,
      );
    });
  }

  test('lists the copyright policy and the acceptable use rules', async ({
    page,
  }) => {
    await page.goto('/en/terms');
    const section = (title: string) =>
      page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: title }) });

    await expect(
      section(`3. ${messages.en.terms.sections.copyright.title}`).getByRole(
        'listitem',
      ),
    ).toHaveCount(5);
    await expect(
      section(`4. ${messages.en.terms.sections.acceptableUse.title}`).getByRole(
        'listitem',
      ),
    ).toHaveCount(6);
    // The playback policy's key phrases are emphasized.
    await expect(
      page.locator('strong', { hasText: 'official YouTube player' }),
    ).toBeVisible();
  });

  test('links to the issue tracker for contact, in a new tab', async ({
    page,
  }) => {
    await page.goto('/pt-BR/terms');

    const link = page.getByRole('link', { name: ISSUES_URL });
    await expect(link).toHaveAttribute('href', ISSUES_URL);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('leads back to the home page in the same locale', async ({ page }) => {
    await page.goto('/pt-BR/terms');

    await expect(
      page.getByRole('link', { name: messages['pt-BR'].terms.home }),
    ).toHaveAttribute('href', '/pt-BR');
  });

  test('declares its canonical URL and hreflang alternates', async ({
    page,
  }) => {
    await page.goto('/pt-BR/terms');

    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      'href',
      /^https?:\/\/[^/]+\/pt-BR\/terms$/,
    );
    await expect(
      page.locator('head link[rel="alternate"][hreflang="en"]'),
    ).toHaveAttribute('href', /^https?:\/\/[^/]+\/en\/terms$/);
  });
});
