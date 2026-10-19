import { expect, type Page, test } from '@playwright/test';

// The practice history of a Profile against the fake API (`fake-user-attempts.ts`):
// runs grouped by day in the viewer's time zone, "Show more" loading the next
// page after the server's first page, the bleed marker, the accuracy bands
// (dot, number and word, in both themes), the transposition with its unit, the
// layout stability of the grouping, and the small-screen smoke check.

const history = (page: Page) =>
  page.getByRole('region', { name: 'Practice history' });

/**
 * Fake run 6 (`Song 6`) was saved at 2026-10-18T23:00Z: the 18th in UTC, the
 * 19th in Auckland (UTC+13 in October).
 */
const SONG_SIX = 'Song 6';

test.describe('practice history in UTC', () => {
  test.use({ timezoneId: 'UTC' });

  test('groups the runs by day, newest first', async ({ page }) => {
    await page.goto('/en/users/ada_lovelace');

    await expect(
      history(page).getByRole('heading', {
        level: 3,
        name: 'October 19, 2026',
      }),
    ).toBeVisible();
    await expect(
      history(page).getByRole('heading', {
        level: 3,
        name: 'October 18, 2026',
      }),
    ).toBeVisible();
    await expect(history(page).getByRole('listitem').first()).toContainText(
      'Song 1',
    );
    await expect(
      history(page).locator('[data-day="2026-10-18"]').getByText(SONG_SIX),
    ).toBeVisible();
  });

  test('loads the next page on "Show more" after the server page', async ({
    page,
  }) => {
    const browserPages: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/attempts')) browserPages.push(request.url());
    });
    await page.goto('/en/users/ada_lovelace');

    await expect(history(page).getByRole('listitem')).toHaveCount(20);
    await history(page).getByRole('button', { name: 'Show more' }).click();

    await expect(history(page).getByRole('listitem')).toHaveCount(23);
    await expect(
      history(page).getByRole('button', { name: 'Show more' }),
    ).toHaveCount(0);
    // The first page came from the server; only the next one is fetched in the browser.
    expect(browserPages).toHaveLength(1);
    expect(browserPages[0]).toContain('cursor=20');
  });

  test('marks a run flagged as bleed-suspected', async ({ page }) => {
    await page.goto('/en/users/ada_lovelace');

    await expect(history(page).getByText('Suspected bleed')).toHaveCount(1);
  });

  test('shows the transposition with its sign and unit, or as the original key', async ({
    page,
  }) => {
    await page.goto('/en/users/ada_lovelace');

    await expect(history(page).getByText('+2 semitones').first()).toBeVisible();
    await expect(history(page).getByText('+1 semitone').first()).toBeVisible();
    await expect(history(page).getByText('-1 semitone').first()).toBeVisible();
    await expect(history(page).getByText('-3 semitones').first()).toBeVisible();
    await expect(history(page).getByText('Original key').first()).toBeVisible();
  });

  test('renders the history in pt-BR', async ({ page }) => {
    await page.goto('/pt-BR/users/ada_lovelace');

    const region = page.getByRole('region', { name: 'Histórico de treinos' });
    await expect(region.getByText('Possível vazamento do som')).toHaveCount(1);
    await expect(region.getByText('+2 semitons').first()).toBeVisible();
    await expect(region.getByText('+1 semitom').first()).toBeVisible();
    await expect(region.getByText('Tom original').first()).toBeVisible();
  });

  test('fits a 360px screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/en/users/ada_lovelace');

    await expect(history(page)).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`shows each accuracy band with its dot, number and word in the ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/en/users/ada_lovelace');

      // The theme really applied: next-themes puts `dark` on <html> for dark only.
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains('dark'),
      );
      expect(isDark).toBe(colorScheme === 'dark');

      // Fake runs 1, 2 and 3 are a hit (92%), near (70%) and a miss (40%).
      const bands = [
        { band: 'hit', number: '92%', word: 'Hit' },
        { band: 'near', number: '70%', word: 'Near' },
        { band: 'miss', number: '40%', word: 'Miss' },
      ] as const;
      const dotColors: string[] = [];
      for (const [index, expected] of bands.entries()) {
        const chip = history(page).getByTestId('accuracy-chip').nth(index);
        await expect(chip).toHaveAttribute('data-band', expected.band);
        await expect(chip).toContainText(expected.number);
        await expect(chip).toContainText(expected.word);
        const dot = chip.getByTestId('accuracy-dot');
        await expect(dot).toBeVisible();
        dotColors.push(
          await dot.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        );
      }

      // The word carries the band for a reader who cannot tell the colors apart,
      // so the three dots must still be three different colors.
      expect(dotColors.every((color) => color !== 'rgba(0, 0, 0, 0)')).toBe(
        true,
      );
      expect(new Set(dotColors).size).toBe(3);
    });
  }
});

test.describe('practice history in a time zone ahead of UTC', () => {
  test.use({ timezoneId: 'Pacific/Auckland' });

  test('moves a run from the 18th in UTC to the 19th in the viewer zone', async ({
    page,
  }) => {
    await page.goto('/en/users/ada_lovelace');

    await expect(
      history(page).locator('[data-day="2026-10-19"]').getByText(SONG_SIX),
    ).toBeVisible();
    await expect(
      history(page).locator('[data-day="2026-10-18"]').getByText(SONG_SIX),
    ).toHaveCount(0);
  });

  test('keeps the layout still while the runs are grouped by day', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.assign(window, { cumulativeLayoutShift: 0 });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        })[]) {
          if (!entry.hadRecentInput && entry.value !== undefined) {
            const state = window as unknown as {
              cumulativeLayoutShift: number;
            };
            state.cumulativeLayoutShift += entry.value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/en/users/ada_lovelace');
    // The grouped list and its "Show more" appear together, after hydration and
    // after the last shift the grouping can cause.
    await expect(
      history(page).locator('[data-day="2026-10-19"]'),
    ).toBeVisible();
    await expect(
      history(page).getByRole('button', { name: 'Show more' }),
    ).toBeVisible();

    const shift = await page.evaluate(
      () =>
        (window as unknown as { cumulativeLayoutShift: number })
          .cumulativeLayoutShift,
    );
    expect(shift).toBeLessThan(0.1);
  });
});
