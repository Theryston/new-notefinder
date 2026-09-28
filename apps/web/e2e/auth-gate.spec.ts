import { expect, test } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

const { auth } = messages.en;
const unverified: MockUser = { ...ADA, emailVerified: false, username: null };
const withoutUsername: MockUser = { ...ADA, username: null };
const onboarded: MockUser = { ...ADA, username: 'ada' };

test.describe('onboarding gate', () => {
  test('leaves signed-out visitors on the page', async ({ page }) => {
    const calls = await mockAuthApi(page);
    await page.goto('/en?x=1');

    await expect
      .poll(() => calls.some((call) => call.url().endsWith('/get-session')))
      .toBe(true);
    await expect(page).toHaveURL(/\/en\?x=1$/);
  });

  test('leaves users who finished onboarding on the page', async ({ page }) => {
    const calls = await mockAuthApi(page, { user: onboarded });
    await page.goto('/en?x=1');

    await expect
      .poll(() => calls.some((call) => call.url().endsWith('/get-session')))
      .toBe(true);
    await expect(page).toHaveURL(/\/en\?x=1$/);
  });

  test('sends a user without a username to pick one, then back', async ({
    page,
  }) => {
    await mockAuthApi(page, { user: withoutUsername });
    await page.goto('/en?x=1');

    await expect(page).toHaveURL(
      /\/en\/setup-username\?redirectTo=%2F%3Fx%3D1$/,
    );
    await page.getByLabel(auth.fields.username.label).fill('ada_l');
    await page.getByRole('button', { name: auth.setupUsername.submit }).click();

    // Back where they were, and not sent to the step again.
    await expect(page).toHaveURL(/\/en\?x=1$/);
    // Let the post-save refresh finish, or the reload would abort it.
    await page.waitForLoadState('networkidle');
    await page.reload();
    await expect(page).toHaveURL(/\/en\?x=1$/);
  });

  test('sends an unverified user to verify the email first', async ({
    page,
  }) => {
    await mockAuthApi(page, { user: unverified });
    await page.goto('/en/setup-username');

    await expect(page).toHaveURL(
      /\/en\/verify-email\?email=ada%40example\.com$/,
    );
    await expect(page.getByText('ada@example.com').first()).toBeVisible();
  });

  test('lets an unverified user sign out', async ({ page }) => {
    const calls = await mockAuthApi(page, { user: unverified });
    await page.goto('/en');
    await expect(page).toHaveURL(/\/en\/verify-email/);

    await page.getByRole('button', { name: auth.session.signOut }).click();

    await expect(page).toHaveURL(/\/en$/);
    expect(calls.some((call) => call.url().endsWith('/sign-out'))).toBe(true);
    await page.waitForLoadState('networkidle');
    await page.reload();
    await expect(page).toHaveURL(/\/en$/);
  });

  test('lets an unverified user change the email', async ({ page }) => {
    const calls = await mockAuthApi(page, { user: unverified });
    await page.goto('/en?from=profile');
    await expect(page).toHaveURL(/\/en\/verify-email/);

    const changeLabel =
      /<link>(.*)<\/link>/.exec(auth.verifyEmail.wrongEmail)?.[1] ?? '';
    await page.getByRole('button', { name: changeLabel }).click();

    // Signed out first, so the gate doesn't bring them back.
    await expect(page).toHaveURL(
      /\/en\/sign-up\?redirectTo=%2F%3Ffrom%3Dprofile$/,
    );
    expect(calls.some((call) => call.url().endsWith('/sign-out'))).toBe(true);
    await expect(
      page.getByRole('heading', { level: 1, name: auth.signUp.title }),
    ).toBeVisible();
  });

  test('lets a user without a username sign out', async ({ page }) => {
    await mockAuthApi(page, { user: withoutUsername });
    await page.goto('/en/setup-username');

    await page.getByRole('button', { name: auth.session.signOut }).click();

    await expect(page).toHaveURL(/\/en$/);
  });
});
