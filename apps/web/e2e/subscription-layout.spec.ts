import { expect, type Page, test } from '@playwright/test';
import type { Subscription } from '@vozzify/contracts';
import { ADA, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

const t = messages['pt-BR'].billing;
const base: Subscription = {
  planId: 'pro',
  planName: 'Pro',
  cycle: 'annual',
  currency: 'USD',
  amount: 12000,
  status: 'confirmed',
  providerStatus: 'active',
  paidMembership: true,
  currentPeriodStart: '2026-10-28T12:00:00.000Z',
  currentPeriodEnd: '2027-10-28T12:00:00.000Z',
  cancelAtPeriodEnd: false,
};

async function mockSubscription(page: Page, subscription: Subscription | null) {
  await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
  await page.route('**/v1/me/subscription?*', (route) =>
    route.fulfill({ json: { subscription } }),
  );
}

for (const width of [360, 1280]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`subscription credential at ${width}px in ${colorScheme} shows the real contract and next payment`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await mockSubscription(page, base);
      await page.goto('/pt-BR/subscription');
      const card = page.getByRole('region', {
        name: t.subscription.planSummary,
      });
      await expect(card.getByRole('heading', { name: 'Pro' })).toBeVisible();
      await expect(card.getByText('US$ 120,00', { exact: true })).toBeVisible();
      await expect(
        card.getByText(t.subscription.annualUnit, { exact: true }),
      ).toBeVisible();
      const nextPayment = page
        .getByRole('listitem')
        .filter({ hasText: t.subscription.nextCharge });
      await expect(nextPayment).toContainText('28 de out. de 2027');
      await expect(page.getByText(t.subscription.periodEnd)).toHaveCount(0);
      await expect(page.getByText('USD', { exact: true })).toBeVisible();
      await expect(
        page.getByText(t.subscription.annual, { exact: true }),
      ).toBeVisible();
      const plans = page.getByRole('link', { name: t.viewPlans, exact: true });
      await expect(plans).toHaveCount(1);
      await expect(plans).toHaveAttribute('href', '/pt-BR/plans');
      await expect(
        card.getByRole('link', { name: t.subscription.findSong }),
      ).toHaveAttribute('href', '/pt-BR/search');
      const bounds = await card.boundingBox();
      const details = await page
        .getByRole('heading', { name: t.subscription.titles.active })
        .boundingBox();
      if (!bounds || !details) throw new Error('Expected subscription layout');
      if (width === 360)
        expect(details.y).toBeGreaterThan(bounds.y + bounds.height);
      else expect(details.x).toBeGreaterThan(bounds.x + bounds.width);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    });
  }
}

test('scheduled cancellation shows an end date instead of a next payment', async ({
  page,
}) => {
  await mockSubscription(page, { ...base, cancelAtPeriodEnd: true });
  await page.goto('/pt-BR/subscription');
  await expect(
    page.getByText(t.subscription.states.ending, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: t.subscription.periodEnd }),
  ).toContainText('28 de out. de 2027');
  await expect(page.getByText(t.subscription.nextCharge)).toHaveCount(0);
  await expect(page.getByText(t.subscription.endingDescription)).toBeVisible();
});

for (const status of ['pending', 'unsuccessful'] as const) {
  test(`${status} payment has one plans link and no claim of renewal`, async ({
    page,
  }) => {
    await mockSubscription(page, {
      ...base,
      status,
      paidMembership: false,
      providerStatus: 'incomplete',
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });
    await page.goto('/pt-BR/subscription');
    await expect(page.getByText(t[status], { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: t.viewPlans, exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('link', { name: t.subscription.findSong }),
    ).toHaveCount(0);
    await expect(
      page.getByText(t.subscription.dateUnavailable, { exact: true }),
    ).toHaveCount(2);
    await expect(page.getByText(t.subscription.nextCharge)).toHaveCount(0);
  });
}

test('a free account is not given an invented contract or payment dates', async ({
  page,
}) => {
  await mockSubscription(page, null);
  await page.goto('/pt-BR/subscription');
  await expect(page.getByText(t.noSubscription, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: t.subscription.freePlan, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(
    page.getByText(t.subscription.contractCurrency, { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: t.viewPlans, exact: true }),
  ).toHaveCount(1);
});

test('pending payment polling updates the credential when confirmation arrives', async ({
  page,
}) => {
  await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
  let confirmed = false;
  await page.route('**/v1/me/subscription?*', (route) =>
    route.fulfill({
      json: {
        subscription: confirmed
          ? base
          : { ...base, status: 'pending', paidMembership: false },
      },
    }),
  );
  await page.goto('/pt-BR/subscription');
  await expect(page.getByText(t.pending, { exact: true })).toBeVisible();
  confirmed = true;
  await expect(
    page.getByText(t.subscription.nextCharge, { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(t.confirmed, { exact: true })).toBeVisible();
});

test('returning from a cancelled checkout keeps the cancellation notice', async ({
  page,
}) => {
  await mockSubscription(page, null);
  await page.goto('/pt-BR/subscription?result=cancelled');
  await expect(page.getByText(t.cancelled, { exact: true })).toBeVisible();
  await expect(page.getByText(t.noSubscription, { exact: true })).toBeVisible();
});

test('the subscription can be retried after an API error', async ({ page }) => {
  await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
  let failed = true;
  await page.route('**/v1/me/subscription?*', (route) =>
    failed
      ? route.fulfill({
          status: 404,
          json: { statusCode: 404, code: 'NOT_FOUND', message: 'Unavailable' },
        })
      : route.fulfill({ json: { subscription: base } }),
  );
  await page.goto('/pt-BR/subscription');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    t.summaryError,
  );
  failed = false;
  await page.getByRole('button', { name: t.retry, exact: true }).click();
  await expect(page.getByText(t.confirmed, { exact: true })).toBeVisible();
});
