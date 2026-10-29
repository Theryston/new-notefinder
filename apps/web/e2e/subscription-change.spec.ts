import { expect, test } from '@playwright/test';
import type { Subscription } from '@vozzify/contracts';
import { ADA, mockAuthApi } from './auth-api-mock';
import { defaultPlanCatalog } from './fake-plans-api';
import { messages } from './messages';

for (const locale of ['en', 'pt-BR'] as const) {
  test(`subscriber confirms a future change in ${locale}`, async ({ page }) => {
    await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
    const subscription: Subscription = {
      planId: 'pro',
      planName: 'Pro',
      cycle: 'monthly',
      currency: 'USD',
      amount: 350,
      status: 'confirmed',
      providerStatus: 'active',
      paidMembership: true,
      currentPeriodStart: '2026-10-28T12:00:00.000Z',
      currentPeriodEnd: '2027-10-28T12:00:00.000Z',
      cancelAtPeriodEnd: false,
      pendingChange: null,
    };
    await page.route('**/v1/plans?*', async (route) => {
      const requested =
        new URL(route.request().url()).searchParams.get('locale') === 'pt-BR'
          ? 'pt-BR'
          : 'en';
      const catalog = defaultPlanCatalog(requested);
      const paid = catalog.plans.find((plan) => plan.kind === 'paid');
      if (paid) paid.saleAvailable = true;
      await route.fulfill({ json: catalog });
    });
    await page.route('**/v1/me/subscription?*', (route) =>
      route.fulfill({ json: { subscription } }),
    );
    await page.route('**/v1/me/subscription/change?*', async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        planId: 'pro',
        offerId: 'annual',
        cycle: 'annual',
      });
      subscription.pendingChange = {
        planId: 'pro',
        planName: 'Pro',
        cycle: 'annual',
        currency: 'USD',
        amount: 3500,
        effectiveAt: '2027-10-28T12:00:00.000Z',
      };
      await route.fulfill({ json: { subscription } });
    });
    await page.goto(`/${locale}/subscription`);
    const t = messages[locale].billing.change;
    await page.getByLabel(t.select).selectOption('annual');
    await page.getByRole('button', { name: t.review }).click();
    await expect(page.getByText(/35[,.]00/)).toBeVisible();
    await page.getByRole('button', { name: t.confirm }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Pro' }),
    ).toBeVisible();
    await expect(
      page.getByText(locale === 'en' ? '$3.50' : 'US$ 3,50'),
    ).toBeVisible();
  });
}
