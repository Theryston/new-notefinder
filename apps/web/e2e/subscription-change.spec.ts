import { expect, test } from '@playwright/test';
import { ADA, mockAuthApi } from './auth-api-mock';
import { defaultPlanCatalog } from './fake-plans-api';
import { messages } from './messages';
import { subscriptionFixture } from './subscription-fixture';

for (const locale of ['en', 'pt-BR'] as const) {
  for (const width of [360, 1280]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`subscriber confirms a future change in ${locale} at ${width}px in ${colorScheme}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme });
        await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
        const subscription = subscriptionFixture({
          currentPeriodEnd: '2027-10-28T12:00:00.000Z',
          pendingChange: null,
        });
        await page.route('**/v1/plans?*', async (route) => {
          const requested =
            new URL(route.request().url()).searchParams.get('locale') ===
            'pt-BR'
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
        const expectedCycles = ['annual', 'monthly'] as const;
        let changeCount = 0;
        await page.route('**/v1/me/subscription/change?*', async (route) => {
          const cycle = expectedCycles[changeCount++];
          if (!cycle) throw new Error('Unexpected extra plan change');
          expect(route.request().postDataJSON()).toEqual({
            planId: 'pro',
            offerId: cycle,
            cycle,
          });
          subscription.pendingChange =
            cycle === 'monthly'
              ? null
              : {
                  planId: 'pro',
                  planName: 'Pro',
                  cycle,
                  currency: 'USD',
                  amount: cycle === 'annual' ? 3500 : 350,
                  effectiveAt: '2027-10-28T12:00:00.000Z',
                };
          await route.fulfill({ json: { subscription } });
        });
        await page.goto(`/${locale}/subscription`);
        const t = messages[locale].billing.change;
        await page.getByRole('button', { name: t.title, exact: true }).click();
        const dialog = page.getByRole('dialog', { name: t.title });
        await expect(
          dialog
            .getByRole('article')
            .filter({ hasText: t.monthly })
            .getByRole('button', {
              name: t.activeOffer,
            }),
        ).toBeDisabled();
        await expect(dialog.getByRole('article')).toHaveCount(2);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
        ).toBe(false);
        await page.screenshot({
          path: testInfo.outputPath('offers.png'),
          animations: 'disabled',
        });
        await dialog
          .getByRole('article')
          .filter({ hasText: t.annual })
          .getByRole('button', { name: t.review })
          .click();
        await expect(
          dialog.getByText(
            t.confirmation
              .replace('{plan}', 'Pro')
              .replace('{cycle}', t.annual)
              .replace('{amount}', locale === 'en' ? '$35.00' : 'US$ 35,00')
              .replace(
                '{date}',
                locale === 'en' ? 'Oct 28, 2027' : '28 de out. de 2027',
              ),
            { exact: true },
          ),
        ).toBeVisible();
        await page.getByRole('button', { name: t.confirm }).click();
        await expect(
          page.getByRole('status').filter({ hasText: 'Pro' }),
        ).toBeVisible();
        const annual = dialog
          .getByRole('article')
          .filter({ hasText: t.annual });
        const monthly = dialog
          .getByRole('article')
          .filter({ hasText: t.monthly });
        await expect(
          annual.getByRole('button', { name: t.scheduledOffer }),
        ).toBeDisabled();
        await monthly.getByRole('button', { name: t.review }).click();
        await dialog.getByRole('button', { name: t.restoreConfirm }).click();
        await expect(
          monthly.getByRole('button', { name: t.activeOffer }),
        ).toBeDisabled();
        await expect(
          annual.getByRole('button', { name: t.review }),
        ).toBeEnabled();
        expect(changeCount).toBe(2);
        await expect(
          dialog.getByRole('status').filter({ hasText: 'Pro' }),
        ).toHaveCount(0);
        await dialog
          .getByRole('button', { name: t.close, exact: true })
          .click();
        await expect(
          page
            .getByRole('region', {
              name: messages[locale].billing.subscription.planSummary,
            })
            .getByText(locale === 'en' ? '$3.50' : 'US$ 3,50', { exact: true }),
        ).toBeVisible();
      });
    }
  }
}
