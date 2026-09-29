import { expect, type Page, test } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';
import {
  currentUserBody,
  type MeReply,
  mockProfileApi,
  multipartFields,
} from './profile-api-mock';

const { profile, auth, errors, header } = messages.en;
const edit = profile.edit;
const ada: MockUser = { ...ADA, username: 'ada' };

const nameInput = (page: Page) =>
  page.getByLabel(auth.fields.name.label, { exact: true });
const saveButton = (page: Page) =>
  page.getByRole('button', { name: edit.save });

/** Opens the page as `ada`, with the profile API answering saves. */
async function openAsAda(
  page: Page,
  reply?: Parameters<typeof mockProfileApi>[1]['reply'],
) {
  await mockAuthApi(page, { user: ada });
  const saves = await mockProfileApi(page, { user: ada, reply });
  await page.goto('/en/me/edit');
  await expect(nameInput(page)).toBeVisible();
  return saves;
}

const rateLimited: MeReply = {
  status: 429,
  body: { statusCode: 429, code: 'RATE_LIMITED', message: 'Too many requests' },
};

test.describe('edit profile: who can open it', () => {
  test('sends signed-out visitors to sign in, then back', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en/me/edit');

    await expect(page).toHaveURL(/\/en\/sign-in\?redirectTo=%2Fme%2Fedit$/);
  });

  test('sends a user without a username to choose one first', async ({
    page,
  }) => {
    await mockAuthApi(page, { user: ADA });
    await page.goto('/en/me/edit');

    await expect(page).toHaveURL(
      /\/en\/setup-username\?redirectTo=%2Fme%2Fedit$/,
    );
  });
});

test.describe('edit profile: the page', () => {
  test('shows the current values, Username and email read-only', async ({
    page,
  }) => {
    await openAsAda(page);
    const main = page.getByRole('main');

    await expect(
      page.getByRole('heading', { level: 1, name: edit.title }),
    ).toBeVisible();
    await expect(nameInput(page)).toHaveValue('Ada Lovelace');
    const username = page.getByLabel(auth.fields.username.label);
    await expect(username).toHaveValue('ada');
    await expect(username).toHaveAttribute('readonly', '');
    const email = page.getByLabel(auth.fields.email.label);
    await expect(email).toHaveValue('ada@example.com');
    await expect(email).toHaveAttribute('readonly', '');
    await expect(
      main.getByRole('link', { name: edit.changePassword }),
    ).toHaveAttribute('href', '/en/forgot-password');
    // No picture yet: the initials stand in.
    await expect(main.getByText('AL', { exact: true })).toBeVisible();
  });

  test('is translated to Portuguese', async ({ page }) => {
    const pt = messages['pt-BR'];
    await mockAuthApi(page, { user: ada });
    await mockProfileApi(page, { user: ada });
    await page.goto('/pt-BR/me/edit');

    await expect(
      page.getByRole('heading', { level: 1, name: pt.profile.edit.title }),
    ).toBeVisible();
    await expect(
      page.getByLabel(pt.auth.fields.name.label, { exact: true }),
    ).toHaveValue('Ada Lovelace');

    await page.getByRole('button', { name: pt.profile.edit.save }).click();
    await expect(page.getByText(pt.profile.edit.saved)).toBeVisible();
  });
});

test.describe('edit profile: saving', () => {
  test('saves the trimmed Name, tells the user and updates the header', async ({
    page,
  }) => {
    const saves = await openAsAda(page);

    await nameInput(page).fill('  Ada King  ');
    await saveButton(page).click();

    await expect(page.getByText(edit.saved)).toBeVisible();
    expect(saves).toHaveLength(1);
    const [save] = saves;
    if (!save) throw new Error('No save request');
    expect(save.method()).toBe('PATCH');
    expect(save.headers()['content-type']).toMatch(/^multipart\/form-data/);
    expect(multipartFields(save)).toEqual({ name: 'Ada King' });
    // The field shows the Name as the API saved it.
    await expect(nameInput(page)).toHaveValue('Ada King');

    await page
      .getByRole('button', { name: header.account.accountMenu })
      .click();
    await expect(page.getByRole('menu')).toContainText('Ada King');
  });

  test('disables Save while it is saving', async ({ page }) => {
    await openAsAda(page, () => ({
      body: currentUserBody(ada),
      delayMs: 800,
    }));

    await saveButton(page).click();
    await expect(saveButton(page)).toBeDisabled();
    await expect(saveButton(page)).toHaveAttribute('aria-busy', 'true');

    await expect(page.getByText(edit.saved)).toBeVisible();
    await expect(saveButton(page)).toBeEnabled();
  });

  test('checks the Name before calling the API', async ({ page }) => {
    const saves = await openAsAda(page);

    await nameInput(page).fill('   ');
    await saveButton(page).click();
    await expect(
      page.getByText(auth.fields.name.errors.required),
    ).toBeVisible();

    await nameInput(page).fill('a'.repeat(101));
    await saveButton(page).click();
    await expect(page.getByText(auth.fields.name.errors.tooLong)).toBeVisible();

    expect(saves).toHaveLength(0);
  });

  test('shows the API error and keeps the typed Name', async ({ page }) => {
    await openAsAda(page, () => rateLimited);

    await nameInput(page).fill('Ada King');
    await saveButton(page).click();

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      errors.RATE_LIMITED,
    );
    await expect(nameInput(page)).toHaveValue('Ada King');
    await expect(page.getByText(edit.saved)).toHaveCount(0);
    await expect(saveButton(page)).toBeEnabled();
  });
});
