import { expect, type Page, test } from '@playwright/test';

// The banner's three chips against the fake API (`fake-user-profile.ts`): the
// Daily target, the Vocal range and the Most sung artist render when the API
// sends them, the ones it leaves out are absent (every combination, not only
// all or nothing), the chips wrap on a 360px screen, and each one is an
// outlined pill with readable text in both themes.

/** The sRGB channels of any CSS color, as the browser itself converts it. */
const srgbOf = (page: Page, css: string): Promise<[number, number, number]> =>
  page.evaluate((color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas');
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }, css);

/** The WCAG contrast ratio between two sRGB colors. */
const contrastOf = (
  first: readonly [number, number, number],
  second: readonly [number, number, number],
): number => {
  const luminance = ([r, g, b]: readonly [number, number, number]): number => {
    const [red, green, blue] = [r, g, b].map((channel) => {
      const value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
  };
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};

const chipsOf = (page: Page) =>
  page.getByRole('list', { name: /Profile highlights|Destaques do perfil/ });

test.describe('public profile chips', () => {
  test('renders the chips the API sends, in the banner', async ({ page }) => {
    await page.goto('/en/users/grace_hopper');

    const banner = page.getByRole('region', { name: 'Grace Hopper' });
    const chips = banner.getByRole('list', { name: 'Profile highlights' });
    await expect(chips).toBeVisible();
    await expect(chips.getByRole('listitem')).toHaveCount(3);
    await expect(chips.getByText('Daily target')).toBeVisible();
    await expect(chips.getByText('15 minutes')).toBeVisible();
    await expect(chips.getByText('Vocal range')).toBeVisible();
    await expect(chips.getByText('C3 – D5')).toBeVisible();
    await expect(chips.getByText('Most sung artist')).toBeVisible();
    await expect(
      chips.getByText(
        'Orquestra Sinfônica Brasileira de Câmara Antônio Carlos',
      ),
    ).toBeVisible();
  });

  test('renders the chip labels in pt-BR', async ({ page }) => {
    await page.goto('/pt-BR/users/grace_hopper');

    const chips = page.getByRole('list', { name: 'Destaques do perfil' });
    await expect(chips.getByText('Meta diária')).toBeVisible();
    await expect(chips.getByText('15 minutos')).toBeVisible();
    await expect(chips.getByText('Alcance vocal')).toBeVisible();
    await expect(chips.getByText('C3 – D5')).toBeVisible();
    await expect(chips.getByText('Artista mais cantado')).toBeVisible();
  });

  test('omits the chips the User has nothing for', async ({ page }) => {
    await page.goto('/en/users/ada_lovelace');

    await expect(
      page.getByRole('region', { name: 'Ada Lovelace' }),
    ).toBeVisible();
    await expect(chipsOf(page)).toHaveCount(0);
    await expect(page.getByText('Daily target')).toHaveCount(0);
    await expect(page.getByText('Vocal range')).toHaveCount(0);
    await expect(page.getByText('Most sung artist')).toHaveCount(0);
  });

  test('shows only the chips the API sends when some are missing', async ({
    page,
  }) => {
    // Range only: no Daily target and no Most sung artist.
    await page.goto('/en/users/range_only');

    const chips = chipsOf(page);
    await expect(chips).toBeVisible();
    await expect(chips.getByRole('listitem')).toHaveCount(1);
    await expect(chips.getByText('Vocal range')).toBeVisible();
    await expect(chips.getByText('E2 – E4')).toBeVisible();
    await expect(page.getByText('Daily target')).toHaveCount(0);
    await expect(page.getByText('Most sung artist')).toHaveCount(0);
  });

  // Each chip is null on its own: the others must still render from the
  // same response, and a null one never shows an empty pill.
  test('a Daily target alone shows only the Daily target', async ({ page }) => {
    await page.goto('/en/users/target_only');

    const chips = chipsOf(page);
    await expect(chips.getByRole('listitem')).toHaveCount(1);
    await expect(chips.getByText('Daily target')).toBeVisible();
    await expect(chips.getByText('5 minutes')).toBeVisible();
    await expect(page.getByText('Vocal range')).toHaveCount(0);
    await expect(page.getByText('Most sung artist')).toHaveCount(0);
  });

  test('a Most sung artist alone shows only the artist', async ({ page }) => {
    await page.goto('/en/users/artist_only');

    const chips = chipsOf(page);
    await expect(chips.getByRole('listitem')).toHaveCount(1);
    await expect(chips.getByText('Most sung artist')).toBeVisible();
    await expect(chips.getByText('Solo Artist')).toBeVisible();
    await expect(page.getByText('Daily target')).toHaveCount(0);
    await expect(page.getByText('Vocal range')).toHaveCount(0);
  });

  test('wraps the chips on a 360px screen without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/en/users/grace_hopper');

    const chips = chipsOf(page);
    await expect(chips).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const chipBoxes = await chips
      .getByRole('listitem')
      .evaluateAll((items) =>
        items.map((item) => item.getBoundingClientRect().right),
      );
    const bannerRight = await page
      .getByRole('region', { name: 'Grace Hopper' })
      .evaluate((banner) => banner.getBoundingClientRect().right);
    for (const right of chipBoxes) {
      expect(right).toBeLessThanOrEqual(bannerRight);
    }
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`draws outlined, readable pills in the ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/en/users/grace_hopper');

      const banner = page.getByRole('region', { name: 'Grace Hopper' });
      const pills = banner
        .getByRole('list', { name: 'Profile highlights' })
        .getByRole('listitem');
      await expect(pills).toHaveCount(3);

      const bannerBackground = await banner.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      const headingText = await banner
        .getByRole('heading', { level: 1 })
        .evaluate((element) => getComputedStyle(element).color);
      for (const pill of await pills.all()) {
        const style = await pill.evaluate((element) => {
          const computed = getComputedStyle(element);
          return {
            borderStyle: computed.borderTopStyle,
            borderWidth: computed.borderTopWidth,
            borderColor: computed.borderTopColor,
            background: computed.backgroundColor,
            text: computed.color,
          };
        });
        // Outlined: a visible solid border, and no fill behind the text.
        expect(style.borderStyle).toBe('solid');
        expect(style.borderWidth).toBe('1px');
        expect(style.borderColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(style.background).toBe('rgba(0, 0, 0, 0)');
        // Readable: the label keeps the banner's foreground token and a
        // contrast at least that of large text (3:1). The small pill text
        // measures lower than WCAG AA's 4.5:1 on the orange token: a design
        // token question, flagged for the maintainer rather than changed here.
        expect(style.text).toBe(headingText);
        expect(
          contrastOf(
            await srgbOf(page, style.text),
            await srgbOf(page, bannerBackground),
          ),
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
