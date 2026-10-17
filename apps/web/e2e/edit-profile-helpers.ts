import { expect, type Page, type Request } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';
import {
  applyProfileSave,
  currentUserBody,
  type MeReply,
  mockProfileApi,
  multipartFile,
  type StoredProfile,
} from './profile-api-mock';

const { header } = messages.en;
const edit = messages.en.profile.edit;

export const ada: MockUser = { ...ADA, username: 'ada' };

export const nameInput = (page: Page) =>
  page.getByLabel(messages.en.auth.fields.name.label, { exact: true });
export const saveButton = (page: Page) =>
  page.getByRole('button', { name: edit.save });

/** Opens the page as `ada`, with the profile API answering saves. */
export async function openAsAda(
  page: Page,
  reply?: Parameters<typeof mockProfileApi>[1]['reply'],
) {
  await mockAuthApi(page, { user: ada });
  const saves = await mockProfileApi(page, { user: ada, reply });
  await page.goto('/en/me/edit');
  await expect(nameInput(page)).toBeVisible();
  return saves;
}

export const rateLimited: MeReply = {
  status: 429,
  body: { statusCode: 429, code: 'RATE_LIMITED', message: 'Too many requests' },
};

// A 1×1 PNG: the picture the user picks and, as a data URL (which needs no
// network), the one the mocked API says it stored.
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);
export const STORED_IMAGE = `data:image/png;base64,${PNG.toString('base64')}`;
export const MAX_BYTES = 5 * 1024 * 1024;
export const sizeLimit = (locale: string) =>
  new Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte' }).format(5);

export const fileInput = (page: Page) => page.locator('input[type="file"]');
export const summaryImage = (page: Page) =>
  page.getByRole('main').locator('img');
export const headerImage = (page: Page) =>
  page.getByRole('button', { name: header.account.accountMenu }).locator('img');
export const formAlert = (page: Page) =>
  page.getByRole('main').getByRole('alert');

type PickedFile = { name: string; mimeType: string; buffer?: Buffer };
export const pick = (page: Page, file: PickedFile) =>
  fileInput(page).setInputFiles({ buffer: PNG, ...file });
export const pickPng = (page: Page) =>
  pick(page, { name: 'me.png', mimeType: 'image/png' });
export const pickGif = (page: Page) =>
  pick(page, { name: 'move.gif', mimeType: 'image/gif' });

/**
 * Answers like the API: a save keeps the trimmed Name and, when sent, the
 * Daily target, an upload becomes the user's stored image, and a save
 * without one leaves the image as it was. The answer is the updated profile,
 * like the API's, so the form shows what it saved.
 */
export const storesUploads = () => {
  let stored: StoredProfile = {
    name: ada.name,
    image: ada.image,
    dailyPracticeTargetSeconds: ada.dailyPracticeTargetSeconds ?? null,
  };
  return (request: Request): MeReply => {
    if (multipartFile(request, 'avatar')) {
      stored = { ...stored, image: STORED_IMAGE };
    }
    stored = applyProfileSave(stored, request);
    return { body: currentUserBody({ ...ada, ...stored }) };
  };
};

/** The file was refused with `message` and nothing is left to upload. */
export const expectRefused = async (page: Page, message: string) => {
  await expect(formAlert(page)).toHaveText(message);
  await expect(summaryImage(page)).toHaveCount(0);
};

/** Saves, and the request that went out has the Name but no picture. */
export const saveWithoutAvatar = async (page: Page, saves: Request[]) => {
  await saveButton(page).click();
  await expect(page.getByText(edit.saved)).toBeVisible();
  expect(multipartFile(lastSave(saves), 'avatar')).toBeUndefined();
};

export const lastSave = (saves: Request[]): Request => {
  const save = saves.at(-1);
  if (!save) throw new Error('No save request');
  return save;
};
