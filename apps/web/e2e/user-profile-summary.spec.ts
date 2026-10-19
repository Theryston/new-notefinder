import { expect, type Locator, type Page, test } from '@playwright/test';

// The Summary section of the Profile page against the fake API
// (`fake-user-profile.ts`): every label and number in both locales, the
// singular and plural forms, the 360px grid and the two themes.
//
// Ada has a 4-day streak, 1,250 sung runs, 7 favorites and 1 contribution.
// Grace has a 1-day streak and nothing else: the singular forms.

/** The stat cell whose label is `label`: the grid's direct child holding it. */
const statCell = (summary: Locator, label: string): Locator =>
  summary.locator('dl > div', { hasText: label });

/** The four stats in order, as the text the reader sees in each cell. */
const expectStats = async (
  summary: Locator,
  expected: { label: string; value: string; caption?: string }[],
): Promise<void> => {
  for (const { label, value, caption } of expected) {
    const cell = statCell(summary, label);
    await expect(cell.locator('dt')).toHaveText(label);
    await expect(cell.locator('dd').first()).toHaveText(value);
    if (caption !== undefined) {
      await expect(cell.locator('dd').nth(1)).toHaveText(caption);
    }
  }
};

/**
 * WCAG contrast ratio of the stat text against the nearest opaque background,
 * read from the rendered page, for the label (`dt`) and the number (`dd`).
 */
const contrastOfStats = (page: Page) =>
  page.evaluate(() => {
    // Chromium reports computed colors as `oklch()` too, so every color goes
    // through a canvas pixel: the browser converts it to sRGB for us.
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No 2D canvas to read colors with');
    }
    const pixelOf = (color: string): number[] => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const luminance = (color: string): number => {
      const [r = 0, g = 0, b = 0] = pixelOf(color);
      const linear = (value: number): number => {
        const scaled = value / 255;
        return scaled <= 0.03928
          ? scaled / 12.92
          : ((scaled + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    };
    // The nearest ancestor with a visible background is the color the text is
    // drawn on; an alpha of 0 means no background at all.
    const backgroundOf = (element: Element): string => {
      for (let node: Element | null = element; node; ) {
        const color = getComputedStyle(node).backgroundColor;
        if ((pixelOf(color)[3] ?? 0) > 0) {
          return color;
        }
        node = node.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const ratio = (foreground: Element) => {
      const text = luminance(getComputedStyle(foreground).color);
      const background = luminance(backgroundOf(foreground));
      const [light, dark] =
        text > background ? [text, background] : [background, text];
      return (light + 0.05) / (dark + 0.05);
    };
    const section = document.querySelector('dl')?.closest('section');
    const label = section?.querySelector('dt');
    const number = section?.querySelector('dd');
    if (!label || !number) {
      throw new Error('The Summary section is not rendered');
    }
    return {
      label: ratio(label),
      number: ratio(number),
      isDark: document.documentElement.classList.contains('dark'),
    };
  });

test.describe('public profile summary section', () => {
  test('renders every label and number of a Profile in English', async ({
    page,
  }) => {
    await page.goto('/en/users/ada_lovelace');

    const summary = page.getByRole('region', { name: 'Summary' });
    await expect(summary).toBeVisible();
    await expectStats(summary, [
      { label: 'Streak', value: '4', caption: 'days' },
      { label: 'Sung', value: '1,250' },
      { label: 'Favorites', value: '7' },
      { label: 'Contributions', value: '1' },
    ]);
  });

  test('renders every label and number of a Profile in pt-BR', async ({
    page,
  }) => {
    await page.goto('/pt-BR/users/ada_lovelace');

    const summary = page.getByRole('region', { name: 'Resumo' });
    await expectStats(summary, [
      { label: 'Sequência', value: '4', caption: 'dias' },
      { label: 'Cantadas', value: '1.250' },
      { label: 'Favoritas', value: '7' },
      { label: 'Contribuições', value: '1' },
    ]);
  });

  test('uses the singular unit for one day in both locales', async ({
    page,
  }) => {
    await page.goto('/en/users/grace_hopper');
    const english = page.getByRole('region', { name: 'Summary' });
    await expect(statCell(english, 'Streak').locator('dd').first()).toHaveText(
      '1',
    );
    await expect(statCell(english, 'Streak').locator('dd').nth(1)).toHaveText(
      'day',
    );

    await page.goto('/pt-BR/users/grace_hopper');
    const portuguese = page.getByRole('region', { name: 'Resumo' });
    await expect(
      statCell(portuguese, 'Sequência').locator('dd').nth(1),
    ).toHaveText('dia');
  });

  for (const [path, heading, streak] of [
    ['/en/users/ada_lovelace', 'Summary', 'Streak'],
    ['/pt-BR/users/ada_lovelace', 'Resumo', 'Sequência'],
  ] as const) {
    test(`fits the two-column grid at 360px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(path);

      const summary = page.getByRole('region', { name: heading });
      await expect(summary).toBeVisible();

      // Every label and number sits inside the 360px viewport.
      const cells = summary.locator('dl > div');
      await expect(cells).toHaveCount(4);
      for (let index = 0; index < 4; index += 1) {
        const box = await cells.nth(index).boundingBox();
        expect(box).not.toBeNull();
        expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
      }

      // Two columns: the streak and the second cell share a row, and the
      // second cell sits to the right of the first.
      const first = await statCell(summary, streak).boundingBox();
      const second = await cells.nth(1).boundingBox();
      expect(second?.y).toBeCloseTo(first?.y ?? -1, 0);
      expect(second?.x ?? 0).toBeGreaterThan(first?.x ?? 0);

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`keeps the stat text readable in the ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/en/users/ada_lovelace');
      await expect(page.getByRole('region', { name: 'Summary' })).toBeVisible();

      const contrast = await contrastOfStats(page);

      expect(contrast.isDark).toBe(colorScheme === 'dark');
      // Small uppercase labels need AA (4.5:1); the big numbers pass it too.
      expect(contrast.label).toBeGreaterThanOrEqual(4.5);
      expect(contrast.number).toBeGreaterThanOrEqual(4.5);
    });
  }
});
