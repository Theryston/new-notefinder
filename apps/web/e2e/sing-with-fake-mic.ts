import { expect, type Page } from '@playwright/test';

/**
 * Turns the dock's mic on and waits for it. Only the `chromium-mic` project
 * has a fake microphone, and it sings the A4 fixture, so the User is singing
 * from here on: the streak counts their practice.
 */
export async function turnMicOn(page: Page, mic: { on: string; off: string }) {
  await page.getByRole('button', { name: mic.on }).click();
  await expect(page.getByRole('button', { name: mic.off })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}
