import { expect, type Page, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';

// The owner's view of a Profile, against the fake API: the Edit profile button
// in the banner and the invitations for the empty sections. `katherine_johnson`
// is the empty Profile (no favorites, no practice runs), so both invitations
// show for her owner and neither section shows for anyone else.
const PROFILE = 'katherine_johnson';
const PROFILE_PATH = `/en/users/${PROFILE}`;
const OTHER_USER = { ...ADA, username: 'ada_lovelace' };
const OWNER = { ...ADA, username: PROFILE };

const editProfile = (page: Page) =>
  page.getByRole('link', { name: 'Edit profile' });
const searchCta = (page: Page) =>
  page.getByRole('link', { name: 'Search for a song' });

test.describe('public profile owner view', () => {
  test('a visitor sees neither owner control', async ({ page }) => {
    await mockAuthApi(page, { user: null });
    await page.goto(PROFILE_PATH);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Katherine Johnson' }),
    ).toBeVisible();
    await expect(editProfile(page)).toHaveCount(0);
    await expect(searchCta(page)).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Favorite songs' }),
    ).toHaveCount(0);
  });

  test('another signed-in User sees neither owner control', async ({
    page,
  }) => {
    await mockAuthApi(page, { user: OTHER_USER });
    await page.goto(PROFILE_PATH);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Katherine Johnson' }),
    ).toBeVisible();
    await expect(editProfile(page)).toHaveCount(0);
    await expect(searchCta(page)).toHaveCount(0);
  });

  test('the owner sees Edit profile and an invitation per empty section', async ({
    page,
  }) => {
    await mockAuthApi(page, { user: OWNER });
    await page.goto(PROFILE_PATH);

    await expect(editProfile(page)).toBeVisible();
    await expect(editProfile(page)).toHaveAttribute('href', '/en/me/edit');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Favorite songs' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Practice history' }),
    ).toBeVisible();
    await expect(searchCta(page)).toHaveCount(2);
    await expect(searchCta(page).first()).toHaveAttribute('href', '/en/search');
  });

  test('the owner’s controls do not move the page the visitor sees', async ({
    page,
  }) => {
    // The Share button sits beside Edit profile in the banner: the owner's
    // button must not push it, nor the page below it.
    const share = page.getByRole('button', { name: 'Share', exact: true });
    await mockAuthApi(page, { user: null });
    await page.goto(PROFILE_PATH);
    await expect(share).toBeVisible();
    const visitorShare = await share.boundingBox();
    const visitorHeading = await page
      .getByRole('heading', { level: 1 })
      .boundingBox();

    await mockAuthApi(page, { user: OWNER });
    await page.goto(PROFILE_PATH);
    await expect(editProfile(page)).toBeVisible();
    const heading = page.getByRole('heading', { level: 1 });

    expect((await share.boundingBox())?.y).toBe(visitorShare?.y);
    expect((await heading.boundingBox())?.y).toBe(visitorHeading?.y);
  });

  test('the owner view fits a 360px screen, light and dark', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await mockAuthApi(page, { user: OWNER });
    await page.goto(PROFILE_PATH);
    await expect(editProfile(page)).toBeVisible();

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(width).toBeLessThanOrEqual(360);
      const box = await editProfile(page).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    }
  });

  test('the owner view is translated', async ({ page }) => {
    await mockAuthApi(page, { user: OWNER });
    await page.goto(`/pt-BR/users/${PROFILE}`);

    await expect(
      page.getByRole('link', { name: 'Editar perfil' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Buscar uma música' }).first(),
    ).toBeVisible();
  });
});
