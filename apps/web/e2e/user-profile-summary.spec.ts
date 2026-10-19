import { expect, test } from '@playwright/test';

// The Summary section of the Profile page against the fake API
// (`fake-user-profile.ts`): the four numbers with their labels in both
// locales (ICU plural and number formatting), the 360px layout and the two
// themes.
test.describe('public profile summary section', () => {
  test('renders the streak and the counters of a Profile', async ({ page }) => {
    await page.goto('/en/users/ada_lovelace');

    const summary = page.getByRole('region', { name: 'Summary' });
    await expect(summary).toBeVisible();
    await expect(summary.getByText('Streak', { exact: true })).toBeVisible();
    await expect(summary.getByText('4', { exact: true })).toBeVisible();
    await expect(summary.getByText('days', { exact: true })).toBeVisible();
    await expect(summary.getByText('1,250', { exact: true })).toBeVisible();
    await expect(summary.getByText('Sung', { exact: true })).toBeVisible();
    await expect(summary.getByText('Favorites', { exact: true })).toBeVisible();
    await expect(
      summary.getByText('Contributions', { exact: true }),
    ).toBeVisible();
  });

  test('renders the summary in pt-BR with its plural and number format', async ({
    page,
  }) => {
    await page.goto('/pt-BR/users/ada_lovelace');

    const summary = page.getByRole('region', { name: 'Resumo' });
    await expect(summary.getByText('Sequência', { exact: true })).toBeVisible();
    await expect(summary.getByText('dias', { exact: true })).toBeVisible();
    await expect(summary.getByText('1.250', { exact: true })).toBeVisible();
    await expect(summary.getByText('Cantadas', { exact: true })).toBeVisible();
  });

  test('fits a 360px screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/en/users/ada_lovelace');

    const summary = page.getByRole('region', { name: 'Summary' });
    await expect(summary).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`renders the summary in the ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/en/users/ada_lovelace');

      await expect(page.getByRole('region', { name: 'Summary' })).toBeVisible();
    });
  }
});
