import { expect, test } from '@playwright/test';

test('a proxy 404 consumes click attribution and keeps other query params', async ({
  page,
}) => {
  const response = await page.goto(
    '/en/tracks/missing-click-id-track?from=home&clickId=click-1',
  );

  expect(response?.status()).toBe(404);
  await expect(page.getByText('404', { exact: true })).toBeVisible();
  await expect(page).toHaveURL('/en/tracks/missing-click-id-track?from=home');
});
