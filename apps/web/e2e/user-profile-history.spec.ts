import { expect, test } from '@playwright/test';

// The practice history of a Profile against the fake API (`fake-user-attempts.ts`):
// runs grouped by day in the viewer's time zone (UTC here), "Show more" loading
// the next page, the bleed marker, accuracy read as a word, and the small-screen
// and theme smoke checks.
test.describe('practice history on the public profile', () => {
  test.use({ timezoneId: 'UTC' });

  test('groups the runs by day, newest first', async ({ page }) => {
    await page.goto('/en/users/ada_lovelace');

    const history = page.getByRole('region', { name: 'Practice history' });
    await expect(history).toBeVisible();
    await expect(
      history.getByRole('heading', { level: 3, name: 'October 19, 2026' }),
    ).toBeVisible();
    await expect(
      history.getByRole('heading', { level: 3, name: 'October 18, 2026' }),
    ).toBeVisible();
    await expect(history.getByRole('listitem').first()).toContainText('Song 1');
  });

  test('loads the next page on "Show more"', async ({ page }) => {
    await page.goto('/en/users/ada_lovelace');

    const history = page.getByRole('region', { name: 'Practice history' });
    await expect(history.getByRole('listitem')).toHaveCount(20);
    await history.getByRole('button', { name: 'Show more' }).click();

    await expect(history.getByRole('listitem')).toHaveCount(23);
    await expect(
      history.getByRole('button', { name: 'Show more' }),
    ).toHaveCount(0);
  });

  test('marks a run flagged as bleed-suspected', async ({ page }) => {
    await page.goto('/en/users/ada_lovelace');

    const history = page.getByRole('region', { name: 'Practice history' });
    await expect(history.getByText('Suspected bleed')).toHaveCount(1);
  });

  test('shows accuracy with its word, not only a color', async ({ page }) => {
    await page.goto('/en/users/ada_lovelace');

    const history = page.getByRole('region', { name: 'Practice history' });
    await expect(history.getByText('Hit').first()).toBeVisible();
    await expect(history.getByText('Near').first()).toBeVisible();
    await expect(history.getByText('Miss').first()).toBeVisible();
  });

  test('renders the history in pt-BR', async ({ page }) => {
    await page.goto('/pt-BR/users/ada_lovelace');

    const history = page.getByRole('region', { name: 'Histórico de treinos' });
    await expect(history.getByText('Possível vazamento do som')).toHaveCount(1);
  });

  test('fits a 360px screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/en/users/ada_lovelace');

    await expect(
      page.getByRole('region', { name: 'Practice history' }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`renders the history in the ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/en/users/ada_lovelace');

      await expect(
        page.getByRole('region', { name: 'Practice history' }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Show more' }),
      ).toBeVisible();
    });
  }
});
