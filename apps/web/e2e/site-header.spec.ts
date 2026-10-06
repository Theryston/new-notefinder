import { expect, type Page, test } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

const { header } = messages.en;
const ada: MockUser = { ...ADA, username: 'ada' };
const PHOTO_URL = 'https://lh3.googleusercontent.com/a/ada-photo=s96-c';
// 1×1 PNG, standing in for the Google profile photo.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

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
  test('offers only sign in, coming back to the page', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en?x=1');
    await headerReady(page);

    const banner = page.getByRole('banner');
    await expect(
      banner.getByRole('link', { name: header.account.signIn }),
    ).toHaveAttribute('href', '/en/sign-in?redirectTo=%2F%3Fx%3D1');
    // The brand and sign in; sign up is one link away on the sign-in page.
    await expect(banner.getByRole('link')).toHaveCount(2);
    // The theme toggle's three buttons, and no "…" menu.
    await expect(banner.getByRole('button')).toHaveCount(3);
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

  test('shows the photo of a user who signed up with Google', async ({
    page,
  }) => {
    await page.route(PHOTO_URL, (route) =>
      route.fulfill({ contentType: 'image/png', body: PNG }),
    );
    await mockAuthApi(page, { user: { ...ada, image: PHOTO_URL } });
    await page.goto('/en');

    await expect(accountButton(page).locator('img')).toHaveAttribute(
      'src',
      PHOTO_URL,
    );
    await expect(accountButton(page)).not.toContainText('AL');
  });

  test('falls back to the initials when the photo fails', async ({ page }) => {
    await page.route(PHOTO_URL, (route) => route.fulfill({ status: 404 }));
    await mockAuthApi(page, { user: { ...ada, image: PHOTO_URL } });
    await page.goto('/en');

    await expect(accountButton(page)).toContainText('AL');
    await expect(accountButton(page).locator('img')).toHaveCount(0);
  });

  test('searches from the field, focused with Ctrl K', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en');

    const field = page.getByRole('searchbox', { name: header.search.label });
    await headerReady(page);
    await page.keyboard.press('Control+k');
    await expect(field).toBeFocused();

    // Focusing alone falls into the search page at once.
    await expect(page).toHaveURL(/\/en\/search$/);

    // A blank query stays there, showing the prompt.
    await field.fill('   ');
    await field.press('Enter');
    await expect(page).toHaveURL(/\/en\/search$/);

    await field.fill('  bohemian   rhapsody ');
    await field.press('Enter');
    await expect(page).toHaveURL(/\/en\/search\?q=bohemian\+rhapsody$/);
  });

  test('switches the theme from the header toggle', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en');
    await headerReady(page);

    const toggle = page
      .getByRole('banner')
      .getByRole('group', { name: header.preferences.theme });
    const dark = toggle.getByRole('button', {
      name: header.preferences.themes.dark,
    });
    const light = toggle.getByRole('button', {
      name: header.preferences.themes.light,
    });

    await dark.click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await expect(dark).toHaveAttribute('aria-pressed', 'true');
    await expect(light).toHaveAttribute('aria-pressed', 'false');

    await light.click();
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await expect(light).toHaveAttribute('aria-pressed', 'true');
    await expect(dark).toHaveAttribute('aria-pressed', 'false');
  });

  test('hints the shortcut with the ⌘ keycap on every platform', async ({
    page,
  }) => {
    await mockAuthApi(page);
    await page.goto('/en');

    const keycap = page.getByRole('banner').locator('kbd');
    await expect(keycap).toHaveText('K');
    await expect(keycap.locator('svg')).toBeVisible();
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

  test('signed out: search and sign in only, the theme is in the footer', async ({
    page,
  }) => {
    await mockAuthApi(page);
    await page.goto('/en');
    await headerReady(page);

    const banner = page.getByRole('banner');
    await expect(
      banner.getByRole('button', { name: header.search.open }),
    ).toBeVisible();
    await expect(
      banner.getByRole('group', { name: header.preferences.theme }),
    ).toHaveCount(0);
    await expect(accountButton(page)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
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
  for (const path of ['/en/sign-in', '/en/sign-up', '/en/forgot-password']) {
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
