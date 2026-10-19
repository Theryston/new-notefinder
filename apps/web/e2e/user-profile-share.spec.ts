import { expect, type Locator, type Page, test } from '@playwright/test';

import { getSiteUrl } from '../lib/env/client';
import { ADA, mockAuthApi } from './auth-api-mock';
import { SIGNED_IN_COOKIE } from './fake-track-api';

// The Share button of the Profile banner, for a visitor and for the owner:
// the dialog opens, the link is the canonical locale-prefixed URL, copy gives
// feedback (or a graceful failure), the five network shortcuts carry the
// translated text, focus stays in the dialog and returns to the button.
const PROFILE = '/en/users/ada_lovelace';
// The origin the app builds its canonical links from (the same source).
const SITE_ORIGIN = getSiteUrl().origin;
const EXPECTED_LINK = `${SITE_ORIGIN}${PROFILE}`;
const EN_TEXT = "See Ada Lovelace's profile on NoteFinder";
const EN_SUBJECT = "Ada Lovelace's profile on NoteFinder";

const shareButton = (page: Page) =>
  page.getByRole('button', { name: 'Share', exact: true });

const dialogOf = (page: Page) =>
  page.getByRole('dialog', { name: 'Share profile' });

const clipboardText = (page: Page) =>
  page.evaluate(() => navigator.clipboard.readText());

/** Opens the Profile's share dialog from the banner and checks its link. */
async function openShareDialog(page: Page): Promise<Locator> {
  await shareButton(page).click();
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Link to share')).toHaveValue(EXPECTED_LINK);
  return dialog;
}

/** The href of one network shortcut, parsed. */
async function networkUrl(page: Page, list: string, name: string) {
  const href = await page
    .getByRole('list', { name: list })
    .getByRole('link', { name, exact: true })
    .getAttribute('href');
  return new URL(href ?? '');
}

/** Whether `element` contains the element that has focus right now. */
async function hasFocusInside(element: Locator): Promise<boolean> {
  return element.evaluate((node) => node.contains(document.activeElement));
}

test.describe('share a Profile', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('copies the canonical link and closes with Esc to the button', async ({
    page,
  }) => {
    await page.goto(PROFILE);
    const dialog = await openShareDialog(page);
    // Nothing of the Track dialog's moment option is offered here.
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Copy link' }).click();
    await expect(
      dialog.getByRole('button', { name: 'Link copied' }),
    ).toBeVisible();
    expect(await clipboardText(page)).toBe(EXPECTED_LINK);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(shareButton(page)).toBeFocused();
  });

  test('closes with the Close button and returns focus to the button', async ({
    page,
  }) => {
    await page.goto(PROFILE);
    await shareButton(page).click();

    const dialog = dialogOf(page);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(shareButton(page)).toBeFocused();
  });

  test('closes with Esc before anything was copied', async ({ page }) => {
    await page.goto(PROFILE);
    await shareButton(page).click();

    await expect(dialogOf(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toBeHidden();
    await expect(shareButton(page)).toBeFocused();
  });

  test('moves focus into the dialog and keeps it there while tabbing', async ({
    page,
  }) => {
    await page.goto(PROFILE);
    await shareButton(page).click();

    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    await expect.poll(() => hasFocusInside(dialog)).toBe(true);

    // Eight Tab presses walk past the link, the copy button, the five
    // networks and back again: focus never leaves the modal.
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press('Tab');
      await expect.poll(() => hasFocusInside(dialog)).toBe(true);
    }
  });

  test('says so and selects the link when the copy is refused', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: () => Promise.reject(new Error('clipboard refused')),
      });
    });
    await page.goto(PROFILE);
    await shareButton(page).click();

    const dialog = dialogOf(page);
    await dialog.getByRole('button', { name: 'Copy link' }).click();

    await expect(
      page.getByText(
        "We couldn't copy the link. Select it and copy it by hand.",
      ),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Copy link' }),
    ).toBeVisible();
    const selected = await dialog
      .getByLabel('Link to share')
      .evaluate(
        (input) =>
          input instanceof HTMLInputElement &&
          input.selectionStart === 0 &&
          input.selectionEnd === input.value.length,
      );
    expect(selected).toBe(true);
  });

  test('links all five networks with the translated text', async ({ page }) => {
    await page.goto(PROFILE);
    await shareButton(page).click();

    const list = 'Share on';
    const whatsapp = await networkUrl(page, list, 'WhatsApp');
    expect(whatsapp.origin).toBe('https://wa.me');
    expect(whatsapp.searchParams.get('text')).toBe(
      `${EN_TEXT} ${EXPECTED_LINK}`,
    );

    const telegram = await networkUrl(page, list, 'Telegram');
    expect(telegram.origin).toBe('https://t.me');
    expect(telegram.searchParams.get('url')).toBe(EXPECTED_LINK);
    expect(telegram.searchParams.get('text')).toBe(EN_TEXT);

    const x = await networkUrl(page, list, 'X');
    expect(x.origin).toBe('https://twitter.com');
    expect(x.searchParams.get('text')).toBe(EN_TEXT);
    expect(x.searchParams.get('url')).toBe(EXPECTED_LINK);

    const facebook = await networkUrl(page, list, 'Facebook');
    expect(facebook.origin).toBe('https://www.facebook.com');
    expect(facebook.searchParams.get('u')).toBe(EXPECTED_LINK);

    const email = await networkUrl(page, list, 'Email');
    expect(email.protocol).toBe('mailto:');
    expect(email.searchParams.get('subject')).toBe(EN_SUBJECT);
    expect(email.searchParams.get('body')).toBe(`${EN_TEXT}\n${EXPECTED_LINK}`);
  });

  test('shares the pt-BR names and text on the pt-BR page', async ({
    page,
  }) => {
    const link = `${SITE_ORIGIN}/pt-BR/users/ada_lovelace`;
    const text = 'Veja o perfil de Ada Lovelace no NoteFinder';
    await page.goto('/pt-BR/users/ada_lovelace');
    await page
      .getByRole('button', { name: 'Compartilhar', exact: true })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Compartilhar perfil' });
    await expect(dialog.getByLabel('Link para compartilhar')).toHaveValue(link);

    const list = 'Compartilhar em';
    const whatsapp = await networkUrl(page, list, 'WhatsApp');
    expect(whatsapp.searchParams.get('text')).toBe(`${text} ${link}`);
    const telegram = await networkUrl(page, list, 'Telegram');
    expect(telegram.searchParams.get('text')).toBe(text);
    const x = await networkUrl(page, list, 'X');
    expect(x.searchParams.get('text')).toBe(text);
    const facebook = await networkUrl(page, list, 'Facebook');
    expect(facebook.searchParams.get('u')).toBe(link);
    const email = await networkUrl(page, list, 'E-mail');
    expect(email.searchParams.get('subject')).toBe(
      'Perfil de Ada Lovelace no NoteFinder',
    );
    expect(email.searchParams.get('body')).toBe(`${text}\n${link}`);
  });

  test('opens for the signed-in owner too', async ({ page, context }) => {
    await context.addCookies([
      { ...SIGNED_IN_COOKIE, domain: 'localhost', path: '/' },
    ]);
    await mockAuthApi(page, { user: { ...ADA, username: 'ada_lovelace' } });
    await page.goto(PROFILE);

    await openShareDialog(page);
  });

  test('fits a 360px screen: the banner button is whole and nothing overflows', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(PROFILE);

    const button = shareButton(page);
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);

    await button.click();
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(
      360,
    );

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
