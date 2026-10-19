import { expect, test } from '@playwright/test';

// The favorite songs section of a Profile against the fake API
// (`fake-user-favorites.ts`): the cover grid linking to each Track, paging
// with the button, the empty section that is absent, and the small-screen
// and theme smoke checks.
test.describe('public profile favorite songs', () => {
  test('renders a cover card per favorite, each linking to its Track', async ({
    page,
  }) => {
    await page.goto('/en/users/ada_lovelace');

    await expect(
      page.getByRole('heading', { level: 2, name: 'Favorite songs' }),
    ).toBeVisible();
    await expect(page.getByText('Favorite Song 21')).toBeVisible();
    const card = page.locator('a[href="/en/tracks/fav-track-21"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Queen');
  });

  test('shows the geometric placeholder for a favorite without cover art', async ({
    page,
  }) => {
    await page.goto('/en/users/ada_lovelace');

    // Odd favorites have no cover in the fake API, so their card is the
    // placeholder: no image, just the decorative shapes on a solid colour.
    const card = page.locator('a[href="/en/tracks/fav-track-21"]');
    await expect(card).toBeVisible();
    await expect(card.locator('img')).toHaveCount(0);
    // The placeholder's root is the only decorative span that clips its shapes.
    await expect(
      card.locator('span[aria-hidden="true"][class*="overflow-hidden"]'),
    ).toHaveCount(1);
  });

  test('loads the next page from the button without a full-page reload', async ({
    page,
  }) => {
    // The infinite-scroll sentinel would race the explicit button, so
    // neutralize it: this test covers the button path only.
    await page.addInitScript(() => {
      const RealObserver = window.IntersectionObserver;
      window.IntersectionObserver = class extends RealObserver {
        override observe(): void {}
      };
    });
    await page.goto('/en/users/ada_lovelace');

    // The first page holds 21 down to 02; the last two wait behind the button.
    await expect(page.getByText('Favorite Song 01')).toHaveCount(0);
    const urlBefore = page.url();
    await page.getByRole('button', { name: 'Load more' }).click();

    await expect(page.getByText('Favorite Song 00')).toBeVisible();
    expect(page.url()).toBe(urlBefore);
    await expect(page.getByText('Favorite Song 21')).toBeVisible();
  });

  test('shows no favorites section for a Profile without favorites', async ({
    page,
  }) => {
    await page.goto('/en/users/katherine_johnson');

    await expect(
      page.getByRole('region', { name: 'Katherine Johnson' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Favorite songs' }),
    ).toHaveCount(0);
  });

  test('renders the section title in pt-BR', async ({ page }) => {
    await page.goto('/pt-BR/users/ada_lovelace');

    await expect(
      page.getByRole('heading', { level: 2, name: 'Músicas favoritas' }),
    ).toBeVisible();
  });

  test('lays the cover grid out in columns inside a 360px screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/en/users/ada_lovelace');

    const first = page.locator('a[href="/en/tracks/fav-track-21"]');
    const second = page.locator('a[href="/en/tracks/fav-track-20"]');
    await expect(first).toBeVisible();
    const [a, b] = await Promise.all([
      first.boundingBox(),
      second.boundingBox(),
    ]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (!a || !b) return;
    // Two cards side by side on the first row, both inside the viewport.
    expect(b.x).toBeGreaterThan(a.x);
    expect(Math.abs(b.y - a.y)).toBeLessThan(1);
    for (const box of [a, b]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    }
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('renders the favorites in light and dark themes', async ({ page }) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/en/users/ada_lovelace');

      await expect(page.getByText('Favorite Song 21')).toBeVisible();
    }
  });
});
