import { expect, type Page, test } from '@playwright/test';

import { mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

const { header } = messages.en;
const footer = (page: Page) => page.getByRole('contentinfo');

test.describe('site footer', () => {
  test('links to the terms', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en');

    await expect(
      footer(page).getByRole('link', { name: header.preferences.terms }),
    ).toHaveAttribute('href', '/en/terms');
  });

  test('switches the language, keeping the page and query', async ({
    page,
  }) => {
    await mockAuthApi(page);
    await page.goto('/en?x=1');

    const language = footer(page).getByRole('group', {
      name: header.preferences.language,
    });
    await expect(
      language.getByRole('button', { name: header.preferences.languages.en }),
    ).toHaveAttribute('aria-pressed', 'true');

    await language
      .getByRole('button', {
        name: header.preferences.languages['pt-BR'],
      })
      .click();
    await expect(page).toHaveURL(/\/pt-BR\?x=1$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      messages['pt-BR'].home.title,
    );
  });
});

test.describe('site footer theme toggle', () => {
  test('is left to the header on desktop', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en');

    await expect(
      footer(page).getByRole('group', { name: header.preferences.theme }),
    ).toHaveCount(0);
  });

  test.describe('on mobile', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('switches the theme from the footer', async ({ page }) => {
      await mockAuthApi(page);
      await page.goto('/en');

      const theme = footer(page).getByRole('group', {
        name: header.preferences.theme,
      });
      const dark = theme.getByRole('button', {
        name: header.preferences.themes.dark,
      });
      await dark.click();
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      await expect(dark).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
