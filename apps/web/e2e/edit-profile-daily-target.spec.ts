import { expect, type Page, test } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import {
  formAlert,
  lastSave,
  nameInput,
  openAsAda,
  rateLimited,
  saveButton,
  storesUploads,
} from './edit-profile-helpers';
import { messages } from './messages';
import {
  type MeReply,
  mockProfileApi,
  multipartFields,
} from './profile-api-mock';

const { errors } = messages.en;
const edit = messages.en.profile.edit;
const ada: MockUser = { ...ADA, username: 'ada' };

const dailyTarget = messages.en.profile.edit.dailyTarget;
const targetRadio = (page: Page, minutes: string) =>
  // Exact: '5 minutes' is a substring of '15 minutes'.
  page.getByRole('radio', { name: minutes, exact: true });

/** Opens the page as `user`, with the profile API answering saves. */
async function openAs(page: Page, user: MockUser) {
  await mockAuthApi(page, { user });
  const saves = await mockProfileApi(page, { user });
  await page.goto('/en/me/edit');
  await expect(nameInput(page)).toBeVisible();
  await expect(targetRadio(page, '5 minutes')).toBeVisible();
  return saves;
}

/** Fills a new Name, picks 10 minutes and saves. */
const fillNamePickTargetAndSave = async (page: Page) => {
  await nameInput(page).fill('Ada King');
  await targetRadio(page, '10 minutes').check();
  await saveButton(page).click();
};

/** The failed save kept the typed Name and the picked target for retry. */
const expectKeptForRetry = async (page: Page) => {
  await expect(formAlert(page)).toHaveText(errors.RATE_LIMITED);
  await expect(nameInput(page)).toHaveValue('Ada King');
  await expect(targetRadio(page, '10 minutes')).toBeChecked();
};

test.describe('edit profile: daily target', () => {
  test('pre-selects 5 minutes for a user who never picked one', async ({
    page,
  }) => {
    await openAsAda(page);

    await expect(targetRadio(page, '5 minutes')).toBeChecked();
    for (const minutes of ['10 minutes', '15 minutes', '30 minutes']) {
      await expect(targetRadio(page, minutes)).not.toBeChecked();
    }
  });

  test('offers only the four presets, with no custom input', async ({
    page,
  }) => {
    await openAsAda(page);
    const group = page.getByRole('group', { name: dailyTarget.label });

    await expect(group.getByRole('radio')).toHaveCount(4);
    await expect(group.getByRole('spinbutton')).toHaveCount(0);
    await expect(group.getByRole('textbox')).toHaveCount(0);
    await expect(group.getByRole('combobox')).toHaveCount(0);
  });

  test('picks another preset and saves it with the profile', async ({
    page,
  }) => {
    const saves = await openAsAda(page);

    await targetRadio(page, '15 minutes').check();
    await nameInput(page).fill('Ada King');
    await saveButton(page).click();

    await expect(page.getByText(edit.saved)).toBeVisible();
    expect(saves).toHaveLength(1);
    expect(multipartFields(lastSave(saves))).toEqual({
      name: 'Ada King',
      dailyPracticeTargetSeconds: '900',
    });
  });

  test('sends no target part when it was not changed', async ({ page }) => {
    const saves = await openAsAda(page);

    await nameInput(page).fill('Ada King');
    await saveButton(page).click();

    await expect(page.getByText(edit.saved)).toBeVisible();
    expect(multipartFields(lastSave(saves))).toEqual({ name: 'Ada King' });
  });

  test('prefills the saved target', async ({ page }) => {
    await openAs(page, {
      ...ada,
      dailyPracticeTargetSeconds: 900,
    });

    await expect(targetRadio(page, '15 minutes')).toBeChecked();
  });

  test('keeps the saved target after reloading', async ({ page }) => {
    const saves = await openAsAda(page);

    await targetRadio(page, '30 minutes').check();
    await saveButton(page).click();
    await expect(page.getByText(edit.saved)).toBeVisible();
    expect(saves).toHaveLength(1);

    await page.reload();
    await expect(targetRadio(page, '30 minutes')).toBeChecked();
  });

  test('round-trips each preset', async ({ page }) => {
    const saves = await openAsAda(page);
    // From the 5-minute default down the list and back to 5, so every save
    // changes the target and sends its part.
    const presets = [
      ['600', '10 minutes'],
      ['900', '15 minutes'],
      ['1800', '30 minutes'],
      ['300', '5 minutes'],
    ] as const;

    for (const [seconds, minutes] of presets) {
      await targetRadio(page, minutes).check();
      await saveButton(page).click();
      await expect(page.getByText(edit.saved)).toBeVisible();
      expect(multipartFields(lastSave(saves))).toMatchObject({
        dailyPracticeTargetSeconds: seconds,
      });
      await expect(targetRadio(page, minutes)).toBeChecked();
    }

    await page.reload();
    await expect(targetRadio(page, '5 minutes')).toBeChecked();
  });

  test('changes the target with the keyboard alone', async ({ page }) => {
    const saves = await openAsAda(page);
    const group = page.getByRole('group', { name: dailyTarget.label });

    // The legend names the group, so it is announced as one.
    await expect(group).toBeVisible();
    await targetRadio(page, '10 minutes').focus();
    await page.keyboard.press('ArrowRight');
    await expect(targetRadio(page, '15 minutes')).toBeChecked();

    await page.keyboard.press('ArrowLeft');
    await expect(targetRadio(page, '10 minutes')).toBeChecked();

    // The keyboard pick saves like a pointer pick.
    await saveButton(page).click();
    await expect(page.getByText(edit.saved)).toBeVisible();
    expect(multipartFields(lastSave(saves))).toMatchObject({
      dailyPracticeTargetSeconds: '600',
    });
  });

  test('keeps the picked target when saving fails', async ({ page }) => {
    await openAsAda(page, () => rateLimited);

    await targetRadio(page, '10 minutes').check();
    await saveButton(page).click();

    await expect(formAlert(page)).toHaveText(errors.RATE_LIMITED);
    await expect(targetRadio(page, '10 minutes')).toBeChecked();
    await expect(saveButton(page)).toBeEnabled();
  });

  test('retries the picked target after a failed save', async ({ page }) => {
    const stored = storesUploads();
    let failing = true;
    const saves = await openAsAda(page, (request) =>
      failing ? rateLimited : stored(request),
    );
    await fillNamePickTargetAndSave(page);

    await expectKeptForRetry(page);

    failing = false;
    await saveButton(page).click();

    await expect(page.getByText(edit.saved)).toBeVisible();
    expect(multipartFields(lastSave(saves))).toMatchObject({
      name: 'Ada King',
      dailyPracticeTargetSeconds: '600',
    });
    await expect(targetRadio(page, '10 minutes')).toBeChecked();
  });

  test('shows an understandable error when the target is rejected', async ({
    page,
  }) => {
    const rejected: MeReply = {
      status: 400,
      body: {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'dailyPracticeTargetSeconds must be one of the presets',
      },
    };
    await openAsAda(page, () => rejected);

    await fillNamePickTargetAndSave(page);

    await expect(formAlert(page)).toHaveText(errors.VALIDATION_FAILED);
    await expect(nameInput(page)).toHaveValue('Ada King');
    await expect(targetRadio(page, '10 minutes')).toBeChecked();
    await expect(page.getByText(edit.saved)).toHaveCount(0);
  });

  test('is translated to Portuguese', async ({ page }) => {
    const pt = messages['pt-BR'].profile.edit.dailyTarget;
    await mockAuthApi(page, { user: ada });
    await mockProfileApi(page, { user: ada });
    await page.goto('/pt-BR/me/edit');

    await expect(page.getByRole('group', { name: pt.label })).toContainText(
      pt.description,
    );
    await expect(targetRadio(page, '5 minutos')).toBeChecked();

    await targetRadio(page, '30 minutos').check();
    await page
      .getByRole('button', { name: messages['pt-BR'].profile.edit.save })
      .click();

    await expect(
      page.getByText(messages['pt-BR'].profile.edit.saved),
    ).toBeVisible();
    await expect(targetRadio(page, '30 minutos')).toBeChecked();
  });
});
