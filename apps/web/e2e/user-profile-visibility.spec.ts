import type { ProfileVisibility } from '@notefinder/contracts';
import { expect, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import {
  OWNER_COOKIE,
  setProfileVisibilityMock,
} from './fake-user-visibility.ts';
import { mockProfileVisibilityApi } from './profile-visibility-api-mock';
import { webServerEnv } from './web-server-env';

// The owner of ada_lovelace's Profile hid the favorite songs. Visitors never
// see the section; the owner sees it dimmed with a toggle that saves at once.
const OWNER = 'ada_lovelace';
const PROFILE_PATH = '/en/users/ada_lovelace';
// The cache tags of the Profile's banner and favorite songs (`cacheTags`).
const CACHE_TAGS = [`user-profile:${OWNER}`, `user-favorites:${OWNER}`];
const SHOWN_EXCEPT_FAVORITES: ProfileVisibility = {
  summary: true,
  practiceHistory: true,
  favorites: false,
};
const HIDE_LABEL = 'Only you can see this';
const SHOW_LABEL = 'Visible to everyone';

const ownerCookie = {
  name: OWNER_COOKIE,
  value: OWNER,
  domain: 'localhost',
  path: '/',
};

const favorites = (page: import('@playwright/test').Page) =>
  page.locator('[data-section="favorites"]');

test.describe('public profile section visibility', () => {
  test.beforeEach(async ({ request }) => {
    // The favorite songs read is cached per Profile: clear it so this test
    // sees the visibility it sets, not what an earlier spec cached.
    const response = await request.post('/api/revalidate', {
      headers: { authorization: `Bearer ${webServerEnv.REVALIDATE_SECRET}` },
      data: { tags: CACHE_TAGS },
    });
    expect(response.ok()).toBe(true);
    await setProfileVisibilityMock({ [OWNER]: SHOWN_EXCEPT_FAVORITES });
    // Next serves the stale entry once while it refreshes in the background
    // (stale-while-revalidate), so wait until a visitor gets the new page.
    await expect
      .poll(async () => (await request.get(PROFILE_PATH)).text(), {
        timeout: 15_000,
      })
      .not.toContain('Favorite Song 21');
  });

  test('a visitor sees the shown sections and no trace of the hidden one', async ({
    page,
  }) => {
    await page.goto(PROFILE_PATH);

    await expect(
      page.getByRole('heading', { level: 2, name: 'Summary' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Favorite songs' }),
    ).toHaveCount(0);
    await expect(page.getByText('Favorite Song 21')).toHaveCount(0);
    await expect(page.getByRole('button', { name: HIDE_LABEL })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SHOW_LABEL })).toHaveCount(0);
  });

  test('the owner sees the hidden section dimmed, labelled, with its toggle', async ({
    context,
    page,
  }) => {
    await context.addCookies([ownerCookie]);
    await mockAuthApi(page, { user: { ...ADA, username: OWNER } });
    await mockProfileVisibilityApi(page, { flags: SHOWN_EXCEPT_FAVORITES });

    await page.goto(PROFILE_PATH);

    await expect(
      page.getByRole('heading', { level: 2, name: 'Favorite songs' }),
    ).toBeVisible();
    const toggle = favorites(page).getByRole('button', { name: HIDE_LABEL });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(favorites(page)).toHaveAttribute('data-visible', 'false');
    await expect(favorites(page)).toHaveClass(/opacity-60/);
  });

  test('the toggle shows the section at once, saves it and confirms with a toast', async ({
    context,
    page,
  }) => {
    await context.addCookies([ownerCookie]);
    await mockAuthApi(page, { user: { ...ADA, username: OWNER } });
    const saves = await mockProfileVisibilityApi(page, {
      flags: SHOWN_EXCEPT_FAVORITES,
      reply: () => ({
        body: { summary: true, practiceHistory: true, favorites: true },
        delayMs: 1500,
      }),
    });
    await page.goto(PROFILE_PATH);

    await favorites(page).getByRole('button', { name: HIDE_LABEL }).click();

    // The save answers after 1.5 s: the change must already show.
    const toggle = favorites(page).getByRole('button', { name: SHOW_LABEL });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true', {
      timeout: 500,
    });
    await expect(favorites(page)).toHaveAttribute('data-visible', 'true');
    await expect(page.getByText('Visibility saved').first()).toBeVisible();
    expect(saves).toHaveLength(1);
    expect(saves[0]?.postDataJSON()).toEqual({ favorites: true });
  });

  test('a failed save rolls the toggle back and says so', async ({
    context,
    page,
  }) => {
    await context.addCookies([ownerCookie]);
    await mockAuthApi(page, { user: { ...ADA, username: OWNER } });
    const saves = await mockProfileVisibilityApi(page, {
      flags: SHOWN_EXCEPT_FAVORITES,
      reply: () => ({
        status: 500,
        body: {
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'Broken on purpose',
        },
      }),
    });
    await page.goto(PROFILE_PATH);

    await favorites(page).getByRole('button', { name: HIDE_LABEL }).click();

    await expect(
      page.getByText('Could not save the visibility. Try again.').first(),
    ).toBeVisible();
    expect(saves).toHaveLength(1);
    await expect(
      favorites(page).getByRole('button', { name: HIDE_LABEL }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(favorites(page)).toHaveAttribute('data-visible', 'false');
  });

  test('the toggle is a keyboard-reachable pressed button', async ({
    context,
    page,
  }) => {
    await context.addCookies([ownerCookie]);
    await mockAuthApi(page, { user: { ...ADA, username: OWNER } });
    await mockProfileVisibilityApi(page, { flags: SHOWN_EXCEPT_FAVORITES });
    await page.goto(PROFILE_PATH);

    const toggle = favorites(page).getByRole('button', { name: HIDE_LABEL });
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});
