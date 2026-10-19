import { expect, type Page, test } from '@playwright/test';

// The Share button of the Profile banner: the dialog opens for a visitor, the
// link is the canonical locale-prefixed URL, copy gives feedback, the network
// shortcuts carry the translated text, and Esc closes it back to the button.
const PROFILE = '/en/users/ada_lovelace';

const shareButton = (page: Page) =>
  page.getByRole('button', { name: 'Share', exact: true });

const clipboardText = (page: Page) =>
  page.evaluate(() => navigator.clipboard.readText());

test.describe('share a Profile', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('copies the canonical link and closes with Esc to the button', async ({
    page,
    baseURL,
  }) => {
    await page.goto(PROFILE);
    await shareButton(page).click();

    const dialog = page.getByRole('dialog', { name: 'Share profile' });
    await expect(dialog).toBeVisible();
    const expected = `${baseURL}${PROFILE}`;
    await expect(dialog.getByLabel('Link to share')).toHaveValue(expected);
    // Nothing of the Track dialog's moment option is offered here.
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Copy link' }).click();
    await expect(
      dialog.getByRole('button', { name: 'Link copied' }),
    ).toBeVisible();
    expect(await clipboardText(page)).toBe(expected);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(shareButton(page)).toBeFocused();
  });

  test('links each network with the translated text', async ({
    page,
    baseURL,
  }) => {
    await page.goto(PROFILE);
    await shareButton(page).click();

    const networks = page.getByRole('list', { name: 'Share on' });
    const link = `${baseURL}${PROFILE}`;
    const text = `See Ada Lovelace's profile on NoteFinder`;

    const whatsapp = new URL(
      (await networks
        .getByRole('link', { name: 'WhatsApp' })
        .getAttribute('href')) ?? '',
    );
    expect(whatsapp.origin).toBe('https://wa.me');
    expect(whatsapp.searchParams.get('text')).toBe(`${text} ${link}`);

    const telegram = new URL(
      (await networks
        .getByRole('link', { name: 'Telegram' })
        .getAttribute('href')) ?? '',
    );
    expect(telegram.searchParams.get('url')).toBe(link);
    expect(telegram.searchParams.get('text')).toBe(text);

    const email = new URL(
      (await networks
        .getByRole('link', { name: 'Email' })
        .getAttribute('href')) ?? '',
    );
    expect(email.protocol).toBe('mailto:');
    expect(email.searchParams.get('subject')).toBe(
      `Ada Lovelace's profile on NoteFinder`,
    );
    expect(email.searchParams.get('body')).toBe(`${text}\n${link}`);
  });

  test('shares the pt-BR text on the pt-BR page', async ({ page, baseURL }) => {
    await page.goto('/pt-BR/users/ada_lovelace');
    await page
      .getByRole('button', { name: 'Compartilhar', exact: true })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Compartilhar perfil' });
    await expect(dialog.getByLabel('Link para compartilhar')).toHaveValue(
      `${baseURL}/pt-BR/users/ada_lovelace`,
    );
    const whatsapp = new URL(
      (await dialog
        .getByRole('list', { name: 'Compartilhar em' })
        .getByRole('link', { name: 'WhatsApp' })
        .getAttribute('href')) ?? '',
    );
    expect(whatsapp.searchParams.get('text')).toBe(
      `Veja o perfil de Ada Lovelace no NoteFinder ${baseURL}/pt-BR/users/ada_lovelace`,
    );
  });

  test('fits a 360px screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(PROFILE);
    await shareButton(page).click();

    const dialog = page.getByRole('dialog', { name: 'Share profile' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
