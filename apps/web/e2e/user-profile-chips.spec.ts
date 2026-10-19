import { expect, test } from '@playwright/test';

// The banner's three chips against the fake API (`fake-user-profile.ts`): the
// Daily target, the Vocal range and the Most sung artist render when the API
// sends them, are absent when it does not, wrap on a 360px screen, and stay
// readable in both themes.
test.describe('public profile chips', () => {
  test('renders the chips the API sends, in the banner', async ({ page }) => {
    await page.goto('/en/users/grace_hopper');

    const banner = page.getByRole('region', { name: 'Grace Hopper' });
    const chips = banner.getByRole('list', { name: 'Profile highlights' });
    await expect(chips).toBeVisible();
    await expect(chips.getByRole('listitem')).toHaveCount(3);
    await expect(chips.getByText('Daily target')).toBeVisible();
    await expect(chips.getByText('15 min')).toBeVisible();
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
    await expect(chips.getByText('15 min')).toBeVisible();
    await expect(chips.getByText('Alcance vocal')).toBeVisible();
    await expect(chips.getByText('Artista mais cantado')).toBeVisible();
  });

  test('omits the chips the User has nothing for', async ({ page }) => {
    await page.goto('/en/users/ada_lovelace');

    await expect(
      page.getByRole('region', { name: 'Ada Lovelace' }),
    ).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Profile highlights' }),
    ).toHaveCount(0);
    await expect(page.getByText('Daily target')).toHaveCount(0);
    await expect(page.getByText('Vocal range')).toHaveCount(0);
    await expect(page.getByText('Most sung artist')).toHaveCount(0);
  });

  test('wraps the chips on a 360px screen without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/en/users/grace_hopper');

    const chips = page.getByRole('list', { name: 'Profile highlights' });
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
    test(`renders the chips in the ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/en/users/grace_hopper');

      await expect(
        page
          .getByRole('region', { name: 'Grace Hopper' })
          .getByRole('list', { name: 'Profile highlights' }),
      ).toBeVisible();
    });
  }
});
