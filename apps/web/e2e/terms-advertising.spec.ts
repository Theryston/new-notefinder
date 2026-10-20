import { expect, type Page, test } from '@playwright/test';

import { TERMS_ADVERTISING_FRAGMENT } from '../lib/terms-fragments';
import { messages } from './messages';

const CONTACT_EMAIL = 'hello@theryston.dev';

const locales = [
  { locale: 'en', heading: messages.en.terms.advertising.title },
  { locale: 'pt-BR', heading: messages['pt-BR'].terms.advertising.title },
] as const;

function advertisingHeading(page: Page, heading: string) {
  return page.getByRole('heading', { level: 3, name: heading });
}

// The section that holds the advertising subsection, found by its fragment.
function advertisingSection(page: Page) {
  return page
    .locator('section')
    .filter({ has: page.locator(`#${TERMS_ADVERTISING_FRAGMENT}`) });
}

test.describe('terms: advertising and sponsored content', () => {
  for (const { locale, heading } of locales) {
    test(`/${locale}/terms#${TERMS_ADVERTISING_FRAGMENT} lands on the section, below the sticky header`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/terms#${TERMS_ADVERTISING_FRAGMENT}`);

      const target = advertisingHeading(page, heading);
      await expect(target).toBeVisible();
      await expect(target).toHaveAttribute('id', TERMS_ADVERTISING_FRAGMENT);

      // The fragment scrolls the page to the heading. The header is sticky,
      // so the heading must sit below its bottom edge rather than behind it.
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const heading = document.getElementById(id);
            const header = document.querySelector('header');
            if (!heading || !header) return Number.NEGATIVE_INFINITY;
            const headingTop = heading.getBoundingClientRect().top;
            return headingTop - header.getBoundingClientRect().bottom;
          }, TERMS_ADVERTISING_FRAGMENT),
        )
        .toBeGreaterThanOrEqual(0);
    });
  }

  test('the section explains the three points in English', async ({ page }) => {
    await page.goto(`/en/terms#${TERMS_ADVERTISING_FRAGMENT}`);

    const section = advertisingSection(page);
    await expect(section.getByRole('listitem')).toHaveCount(3);
    await expect(section).toContainText('Google Ads');
  });

  test('the sponsorship line is a mailto link to the contact address', async ({
    page,
  }) => {
    await page.goto(`/pt-BR/terms#${TERMS_ADVERTISING_FRAGMENT}`);

    const link = advertisingSection(page).getByRole('link', {
      name: CONTACT_EMAIL,
    });
    await expect(link).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    await expect(link).not.toHaveAttribute('target', '_blank');
  });

  test('the legacy /terms redirect keeps the fragment', async ({ page }) => {
    await page.goto(`/terms#${TERMS_ADVERTISING_FRAGMENT}`);

    await expect(page).toHaveURL(
      new RegExp(`/(en|pt-BR)/terms#${TERMS_ADVERTISING_FRAGMENT}$`),
    );
    await expect(
      advertisingHeading(page, messages.en.terms.advertising.title),
    ).toBeVisible();
  });
});
