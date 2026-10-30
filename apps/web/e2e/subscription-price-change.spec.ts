import { expect, test } from '@playwright/test';
import type { AdminPlan, SaveAdminPlanBody } from '@vozzify/contracts';
import { adminUser, regularUser } from './admin-users';
import { mockAuthApi } from './auth-api-mock';
import { defaultPlanCatalog } from './fake-plans-api';
import { messages } from './messages';
import { subscriptionFixture } from './subscription-fixture';

for (const locale of ['en', 'pt-BR'] as const) {
  test(`admin edits a price and the subscriber sees the pending renewal in ${locale}`, async ({
    page,
    context,
  }) => {
    const t = messages[locale];
    const plan: AdminPlan = {
      id: 'pro',
      kind: 'paid',
      displayOrder: 0,
      trialDays: 0,
      published: true,
      saleEnabled: true,
      enabledCycles: ['monthly'],
      syncStatus: 'synced',
      pendingOperation: null,
      copy: {
        en: { name: 'Pro', description: 'Support singing.' },
        'pt-BR': { name: 'Pro', description: 'Localized support.' },
      },
      prices: [
        { cycle: 'monthly', currency: 'USD', amount: 350 },
        { cycle: 'monthly', currency: 'BRL', amount: 1990 },
      ],
    };
    let changed = false;
    await mockAuthApi(page, { user: adminUser });
    await page.route('**/v1/admin/plans**', async (route) => {
      const headers = {
        'access-control-allow-origin': route.request().headers().origin ?? '*',
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      };
      if (route.request().method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers });
      if (route.request().method() === 'GET')
        return route.fulfill({
          json: { contractingEnabled: true, plans: [plan] },
          headers,
        });
      const input = route.request().postDataJSON() as SaveAdminPlanBody;
      plan.prices = input.prices;
      plan.priceMigrations = { pending: 1, failed: 0 };
      changed = true;
      await route.fulfill({ json: plan, headers });
    });
    await page.goto(`/${locale}/admin/plans`);
    await expect(
      page.getByText(
        locale === 'en'
          ? 'Billing is being validated in Stripe test mode. Price changes apply to existing subscribers at a renewal after at least 30 days’ notice.'
          : 'A cobrança está sendo validada no modo de teste do Stripe. Alterações de preço são aplicadas às assinaturas existentes em uma renovação após aviso com pelo menos 30 dias de antecedência.',
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole('button', { name: t.adminPlans.edit.replace('{name}', 'Pro') })
      .click();
    await page.locator('#monthly-USD').fill('500');
    await page
      .getByRole('button', { name: t.adminPlans.save, exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: '1' }),
    ).toBeVisible();
    expect(changed).toBe(true);

    const subscriber = await context.newPage();
    await mockAuthApi(subscriber, { user: regularUser });
    await subscriber.route('**/v1/plans?*', (route) =>
      route.fulfill({
        json: defaultPlanCatalog(locale),
        headers: {
          'access-control-allow-origin':
            route.request().headers().origin ?? '*',
          'access-control-allow-credentials': 'true',
        },
      }),
    );
    await subscriber.route('**/v1/me/subscription?*', (route) =>
      route.fulfill({
        headers: {
          'access-control-allow-origin':
            route.request().headers().origin ?? '*',
          'access-control-allow-credentials': 'true',
        },
        json: {
          subscription: subscriptionFixture({
            pendingPriceChange: changed
              ? {
                  amount: 500,
                  currency: 'USD',
                  effectiveAt: '2027-02-20T12:00:00.000Z',
                  status: 'scheduled',
                }
              : null,
          }),
        },
      }),
    );
    await subscriber.goto(`/${locale}/subscription`);
    await expect(
      subscriber
        .getByRole('status')
        .filter({ hasText: locale === 'en' ? '$5.00' : 'US$ 5,00' }),
    ).toBeVisible();
    await expect(
      subscriber.getByText(locale === 'en' ? '$3.50' : 'US$ 3,50', {
        exact: true,
      }),
    ).toBeVisible();
    await subscriber.close();
  });
}
