import { expect, type Page, test } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

const { header } = messages.en;
const ada: MockUser = { ...ADA, username: 'ada' };

const menuButton = (page: Page) =>
  page.getByRole('button', { name: header.account.menu, exact: true });
const accountButton = (page: Page) =>
  page.getByRole('button', { name: header.account.accountMenu });

/**
 * Waits for the header to hydrate (the account links only render in the
 * browser), so its scroll and keyboard listeners are attached.
 */
const headerReady = (page: Page) =>
  expect(
    page.getByRole('banner').getByRole('link', { name: header.account.signIn }),
  ).toBeVisible();

test.describe('site header (desktop)', () => {
  test('offers sign in and sign up that come back to the page', async ({
    page,
  }) => {
    await mockAuthApi(page);
    await page.goto('/en?x=1');

    const banner = page.getByRole('banner');
    await expect(
      banner.getByRole('link', { name: header.account.signIn }),
    ).toHaveAttribute('href', '/en/sign-in?redirectTo=%2F%3Fx%3D1');
    await expect(
      banner.getByRole('link', { name: header.account.signUp }),
    ).toHaveAttribute('href', '/en/sign-up?redirectTo=%2F%3Fx%3D1');
    await expect(accountButton(page)).toHaveCount(0);
  });

  test('shows the signed-in user menu and signs out in place', async ({
    page,
  }) => {
    await mockAuthApi(page, { user: ada });
    await page.goto('/en?x=1');

    await accountButton(page).click();
    const menu = page.getByRole('menu');
    await expect(menu).toContainText('Ada Lovelace');
    await expect(menu).toContainText('@ada');
    await expect(
      menu.getByRole('menuitem', { name: header.account.myProfile }),
    ).toHaveAttribute('href', '/en/users/ada');
    await expect(
      menu.getByRole('menuitem', { name: header.account.editProfile }),
    ).toHaveAttribute('href', '/en/me/edit');

    await menu.getByRole('menuitem', { name: header.account.signOut }).click();
    await expect(
      page.getByRole('link', { name: header.account.signIn }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\?x=1$/);
  });

  test('searches from the field, focused with Ctrl K', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en');

    const field = page.getByRole('searchbox', { name: header.search.label });
    await headerReady(page);
    await page.keyboard.press('Control+k');
    await expect(field).toBeFocused();

    // A blank query goes nowhere.
    await field.fill('   ');
    await field.press('Enter');
    await expect(page).toHaveURL(/\/en$/);

    await field.fill('  bohemian   rhapsody ');
    await field.press('Enter');
    await expect(page).toHaveURL(/\/en\/search\?q=bohemian\+rhapsody$/);
  });

  test('switches the theme', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en');

    await menuButton(page).click();
    await page
      .getByRole('menuitem', { name: header.preferences.theme })
      .click();
    await page
      .getByRole('menuitemradio', { name: header.preferences.themes.dark })
      .click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  });

  test('switches the language, keeping the page and query', async ({
    page,
  }) => {
    await mockAuthApi(page);
    await page.goto('/en?x=1');

    await menuButton(page).click();
    await page
      .getByRole('menuitem', { name: header.preferences.language })
      .click();
    await page
      .getByRole('menuitemradio', {
        name: header.preferences.languages['pt-BR'],
      })
      .click();
    await expect(page).toHaveURL(/\/pt-BR\?x=1$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      messages['pt-BR'].home.title,
    );
  });

  test('hides while scrolling down and comes back on scroll up', async ({
    page,
  }) => {
    await mockAuthApi(page);
    await page.goto('/en');
    const banner = page.getByRole('banner');
    await headerReady(page);

    await page.mouse.wheel(0, 800);
    await expect(banner).toHaveAttribute('data-hidden', 'true');
    await page.mouse.wheel(0, -200);
    await expect(banner).not.toHaveAttribute('data-hidden');
  });

  test('skip link moves focus past the header', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en');

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: header.skipToContent });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});

test.describe('site header (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('expands the search over the bar and collapses it', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en');

    const field = page.getByRole('searchbox', { name: header.search.label });
    await expect(field).toBeHidden();
    await page.getByRole('button', { name: header.search.open }).click();
    await expect(field).toBeFocused();

    await page.getByRole('button', { name: header.search.cancel }).click();
    await expect(field).toBeHidden();

    await page.getByRole('button', { name: header.search.open }).click();
    await field.fill('queen');
    await field.press('Enter');
    await expect(page).toHaveURL(/\/en\/search\?q=queen$/);
  });

  test('signed out: sign in in the bar, sign up in the sheet', async ({
    page,
  }) => {
    await mockAuthApi(page);
    await page.goto('/en');

    const banner = page.getByRole('banner');
    await expect(
      banner.getByRole('link', { name: header.account.signIn }),
    ).toBeVisible();
    await expect(
      banner.getByRole('link', { name: header.account.signUp }),
    ).toBeHidden();

    await menuButton(page).click();
    const sheet = page.getByRole('dialog', { name: header.account.menu });
    await expect(
      sheet.getByRole('link', { name: header.account.signUp }),
    ).toBeVisible();
    await sheet
      .getByRole('button', { name: header.preferences.themes.dark })
      .click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  });

  test('signed in: the avatar opens the account sheet', async ({ page }) => {
    await mockAuthApi(page, { user: ada });
    await page.goto('/en');

    await accountButton(page).click();
    const sheet = page.getByRole('dialog', {
      name: header.account.accountMenu,
    });
    await expect(sheet).toContainText('@ada');
    await expect(
      sheet.getByRole('link', { name: header.account.myProfile }),
    ).toHaveAttribute('href', '/en/users/ada');

    await sheet.getByRole('button', { name: header.account.signOut }).click();
    await expect(
      page.getByRole('link', { name: header.account.signIn }),
    ).toBeVisible();
  });
});

test.describe('pages without the site header', () => {
  for (const path of [
    '/en/sign-in',
    '/en/sign-up',
    '/en/forgot-password',
    '/en/terms',
  ]) {
    test(`${path} has no site header`, async ({ page }) => {
      await mockAuthApi(page);
      await page.goto(path);

      await expect(
        page.getByRole('searchbox', { name: header.search.label }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: header.skipToContent }),
      ).toHaveCount(0);
    });
  }
});
