import { expect, type Page, type Request, test } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';
import {
  currentUserBody,
  type MeReply,
  mockProfileApi,
  multipartFields,
  multipartFile,
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
    // Username and email are text rows, not fields: nothing there to edit.
    const account = main.getByRole('region', { name: edit.sections.account });
    await expect(account.getByText('@ada')).toBeVisible();
    await expect(account.getByText('ada@example.com')).toBeVisible();
    await expect(account.getByRole('textbox')).toHaveCount(0);
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

const sectionBox = async (page: Page, name: string) => {
  const box = await page.getByRole('region', { name }).boundingBox();
  if (!box) throw new Error(`Section "${name}" is not on screen`);
  return box;
};
const scrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test.describe('edit profile: layout', () => {
  test('puts the two sections side by side on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openAsAda(page);

    const profile = await sectionBox(page, edit.sections.profile);
    const account = await sectionBox(page, edit.sections.account);

    // Wider than the old narrow column, with the card beside the form.
    expect(profile.width).toBeGreaterThan(576);
    expect(account.x).toBeGreaterThanOrEqual(profile.x + profile.width);
    expect(Math.abs(account.y - profile.y)).toBeLessThan(2);
  });

  test('stacks them on a phone without scrolling sideways', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openAsAda(page);

    const profile = await sectionBox(page, edit.sections.profile);
    const account = await sectionBox(page, edit.sections.account);

    expect(account.y).toBeGreaterThanOrEqual(profile.y + profile.height);
    expect(Math.abs(account.x - profile.x)).toBeLessThan(2);
    expect(await scrollsSideways(page)).toBe(false);
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

// A 1×1 PNG: the picture the user picks and, as a data URL (which needs no
// network), the one the mocked API says it stored.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);
const STORED_IMAGE = `data:image/png;base64,${PNG.toString('base64')}`;
const MAX_BYTES = 5 * 1024 * 1024;
const sizeLimit = (locale: string) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte' }).format(5);

const fileInput = (page: Page) => page.locator('input[type="file"]');
const summaryImage = (page: Page) => page.getByRole('main').locator('img');
const headerImage = (page: Page) =>
  page.getByRole('button', { name: header.account.accountMenu }).locator('img');
const formAlert = (page: Page) => page.getByRole('main').getByRole('alert');

type PickedFile = { name: string; mimeType: string; buffer?: Buffer };
const pick = (page: Page, file: PickedFile) =>
  fileInput(page).setInputFiles({ buffer: PNG, ...file });
const pickPng = (page: Page) =>
  pick(page, { name: 'me.png', mimeType: 'image/png' });
const pickGif = (page: Page) =>
  pick(page, { name: 'move.gif', mimeType: 'image/gif' });

/**
 * Answers like the API: an upload becomes the user's stored image, and a save
 * without one leaves the image as it was.
 */
const storesUploads = () => {
  let image: string | null = null;
  return (request: Request): MeReply => {
    if (multipartFile(request, 'avatar')) image = STORED_IMAGE;
    return {
      body: currentUserBody({ ...ada, image }, multipartFields(request).name),
    };
  };
};

/** The file was refused with `message` and nothing is left to upload. */
const expectRefused = async (page: Page, message: string) => {
  await expect(formAlert(page)).toHaveText(message);
  await expect(summaryImage(page)).toHaveCount(0);
};

/** Saves, and the request that went out has the Name but no picture. */
const saveWithoutAvatar = async (page: Page, saves: Request[]) => {
  await saveButton(page).click();
  await expect(page.getByText(edit.saved)).toBeVisible();
  expect(multipartFile(lastSave(saves), 'avatar')).toBeUndefined();
};

const lastSave = (saves: Request[]): Request => {
  const save = saves.at(-1);
  if (!save) throw new Error('No save request');
  return save;
};

test.describe('edit profile: picking an Avatar', () => {
  test('previews the picked file without uploading it', async ({ page }) => {
    const saves = await openAsAda(page, storesUploads());
    await expect(summaryImage(page)).toHaveCount(0);

    await pickPng(page);

    await expect(summaryImage(page)).toHaveAttribute('src', /^blob:/);
    await expect(
      page.getByText(edit.avatar.hint.replace('{size}', sizeLimit('en'))),
    ).toBeVisible();
    expect(saves).toHaveLength(0);
  });

  test('offers only PNG, JPEG and WEBP in the file dialog', async ({
    page,
  }) => {
    await openAsAda(page);

    await expect(fileInput(page)).toHaveAttribute(
      'accept',
      'image/png,image/jpeg,image/webp',
    );
    await expect(
      page.getByRole('button', { name: edit.avatar.change }),
    ).toBeVisible();
  });

  test('refuses an image over the size limit before uploading', async ({
    page,
  }) => {
    const saves = await openAsAda(page);

    await pick(page, {
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(MAX_BYTES + 1),
    });

    await expectRefused(
      page,
      edit.avatar.errors.tooLarge.replace('{size}', sizeLimit('en')),
    );
    await saveWithoutAvatar(page, saves);
  });

  test('refuses a file that is not a PNG, JPEG or WEBP image', async ({
    page,
  }) => {
    await openAsAda(page);

    await pickGif(page);

    await expectRefused(page, edit.avatar.errors.unsupportedType);
  });

  test('drops a picked file when the next one is refused', async ({ page }) => {
    const saves = await openAsAda(page);
    await pickPng(page);
    await expect(summaryImage(page)).toHaveAttribute('src', /^blob:/);

    await pick(page, { name: 'notes.pdf', mimeType: 'application/pdf' });

    await expectRefused(page, edit.avatar.errors.unsupportedType);
    await saveWithoutAvatar(page, saves);
  });

  test('takes the next valid file after a refused one', async ({ page }) => {
    await openAsAda(page);
    await pickGif(page);
    await expect(formAlert(page)).toBeVisible();

    await pickPng(page);

    await expect(formAlert(page)).toHaveCount(0);
    await expect(summaryImage(page)).toHaveAttribute('src', /^blob:/);
  });

  test('is translated to Portuguese', async ({ page }) => {
    const pt = messages['pt-BR'].profile.edit.avatar;
    await mockAuthApi(page, { user: ada });
    await mockProfileApi(page, { user: ada });
    await page.goto('/pt-BR/me/edit');

    await expect(page.getByRole('button', { name: pt.change })).toBeVisible();
    await expect(
      page.getByText(pt.hint.replace('{size}', sizeLimit('pt-BR'))),
    ).toBeVisible();

    await pickGif(page);

    await expect(formAlert(page)).toHaveText(pt.errors.unsupportedType);
  });
});

test.describe('edit profile: saving an Avatar', () => {
  test('sends the file with the Name and shows it in the page and header', async ({
    page,
  }) => {
    const saves = await openAsAda(page, storesUploads());

    await nameInput(page).fill('Ada King');
    await pickPng(page);
    await saveButton(page).click();

    await expect(page.getByText(edit.saved)).toBeVisible();
    expect(saves).toHaveLength(1);
    const request = lastSave(saves);
    expect(request.method()).toBe('PATCH');
    expect(request.headers()['content-type']).toMatch(/^multipart\/form-data/);
    expect(multipartFields(request)).toEqual({ name: 'Ada King' });
    expect(multipartFile(request, 'avatar')).toEqual({
      filename: 'me.png',
      contentType: 'image/png',
      bytes: PNG,
    });
    await expect(summaryImage(page)).toHaveAttribute('src', STORED_IMAGE);
    await expect(headerImage(page)).toHaveAttribute('src', STORED_IMAGE);
  });

  test('sends only the Name once the Avatar is saved', async ({ page }) => {
    const saves = await openAsAda(page, storesUploads());
    await pickPng(page);
    await saveButton(page).click();
    await expect(page.getByText(edit.saved)).toBeVisible();

    await nameInput(page).fill('Ada King');
    await saveButton(page).click();

    await expect.poll(() => saves.length).toBe(2);
    expect(multipartFile(lastSave(saves), 'avatar')).toBeUndefined();
    expect(multipartFields(lastSave(saves))).toEqual({ name: 'Ada King' });
  });

  test('keeps the picked file and the Name when saving fails', async ({
    page,
  }) => {
    const invalidImage: MeReply = {
      status: 400,
      body: {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Avatar could not be read as an image',
      },
    };
    const stored = storesUploads();
    let failing = true;
    const saves = await openAsAda(page, (request) =>
      failing ? invalidImage : stored(request),
    );
    await nameInput(page).fill('Ada King');
    await pickPng(page);

    await saveButton(page).click();

    await expect(formAlert(page)).toHaveText(errors.VALIDATION_FAILED);
    await expect(nameInput(page)).toHaveValue('Ada King');
    await expect(summaryImage(page)).toHaveAttribute('src', /^blob:/);

    failing = false;
    await saveButton(page).click();

    await expect(page.getByText(edit.saved)).toBeVisible();
    expect(multipartFile(lastSave(saves), 'avatar')?.filename).toBe('me.png');
    await expect(headerImage(page)).toHaveAttribute('src', STORED_IMAGE);
  });
});
