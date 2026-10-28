import type { Locale, PlanCatalog } from '@notefinder/contracts';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { ADA, mockAuthApi } from './auth-api-mock';
import { defaultPlanCatalog } from './fake-plans-api';
import { messages } from './messages';

type InstallCatalog = (
  locale: Locale,
  reply: { catalog?: PlanCatalog },
) => Promise<void>;
const viewports = [
  { name: 'mobile', width: 360 },
  { name: 'desktop', width: 1280 },
] as const;

export function registerPlanLayoutJourneys(install: InstallCatalog) {
  for (const viewport of viewports) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`studio plans keep prices and availability readable on ${viewport.name} in ${colorScheme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: 900 });
        await page.emulateMedia({ colorScheme });
        await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
        const catalog = defaultPlanCatalog('pt-BR');
        const plan = catalog.plans.find((item) => item.id === 'pro');
        if (!plan) throw new Error('Expected Pro');
        plan.saleAvailable = true;
        await install('pt-BR', { catalog });
        await verifyStudioPlan(page, catalog, viewport.name === 'mobile');
        await install('pt-BR', { catalog: defaultPlanCatalog('pt-BR') });
      });
    }
  }
}

async function verifyStudioPlan(
  page: Page,
  catalog: PlanCatalog,
  mobile: boolean,
) {
  const t = messages['pt-BR'].plans;
  const paidPlan = catalog.plans.find((item) => item.kind === 'paid');
  const freePlan = catalog.plans.find((item) => item.kind === 'free');
  if (!freePlan || !paidPlan) throw new Error('Expected both plans');
  const pro = page.getByRole('article', { name: paidPlan.name, exact: true });
  const free = page.getByRole('article', { name: freePlan.name, exact: true });
  await expect(async () => {
    await page.goto('/pt-BR/plans');
    await expect(
      pro.getByRole('button', {
        name: t.choosePlan.replace('{plan}', paidPlan.name),
      }),
    ).toBeVisible();
  }).toPass();
  await assertPlanPositions({ free, pro, mobile });
  await pro.getByRole('radio', { name: new RegExp(t.annual) }).check();
  await expect(
    pro.getByTestId('plan-price').getByText('16,58', { exact: true }),
  ).toBeVisible();
  const total = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: catalog.currency,
  }).format(199);
  await expect(
    pro
      .getByTestId('plan-price')
      .getByText(t.annualCharge.replace('{amount}', total), { exact: true }),
  ).toBeVisible();
  await expect(pro.getByRole('listitem')).toHaveCount(7);
  for (const benefit of paidPlan.benefits) {
    await expect(pro.getByText(benefit.name, { exact: true })).toBeVisible();
    await expect(
      pro.getByRole('listitem').filter({ hasText: benefit.name }),
    ).toHaveAttribute('title', benefit.description);
  }
  await expect(
    free.getByRole('link', { name: t.preview.findSong }),
  ).toHaveAttribute('href', '/pt-BR/search');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
}

async function assertPlanPositions({
  free,
  pro,
  mobile,
}: {
  free: Locator;
  pro: Locator;
  mobile: boolean;
}) {
  const freeBounds = await free.boundingBox();
  const proBounds = await pro.boundingBox();
  if (!freeBounds || !proBounds) throw new Error('Expected both plans');
  if (mobile) expect(proBounds.y).toBeLessThan(freeBounds.y);
  else expect(freeBounds.x + freeBounds.width).toBeLessThan(proBounds.x);
}
