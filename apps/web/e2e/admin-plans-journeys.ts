import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';
import type {
  AdminPlan,
  AdminPlanCatalog,
  Locale,
  SaveAdminPlanBody,
} from '@vozzify/contracts';
import { adminLocales, adminUser, regularUser } from './admin-users';
import { mockAuthApi } from './auth-api-mock';
import { defaultPlanCatalog } from './fake-plans-api';
import { messages } from './messages';
import { webServerEnv } from './web-server-env';

const headers = {
  'access-control-allow-origin': 'http://localhost:3000',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
};

async function setPublicCatalog(
  request: APIRequestContext,
  locale: Locale,
  plan?: AdminPlan,
) {
  const catalog = defaultPlanCatalog(locale);
  const currency = locale === 'en' ? 'USD' : 'BRL';
  if (plan)
    catalog.plans.push({
      id: plan.id,
      kind: 'paid',
      ...plan.copy[locale],
      trialDays: 0,
      offers: plan.prices
        .filter(
          (price) =>
            price.currency === currency &&
            plan.enabledCycles.includes(price.cycle),
        )
        .map((price) => ({ ...price, id: `studio-${price.cycle}` })),
      benefits: [],
    });
  await request.post('http://127.0.0.1:3333/__plans-mock/set', {
    data: { locale, catalog },
  });
  await request.post('/api/revalidate', {
    headers: { authorization: `Bearer ${webServerEnv.REVALIDATE_SECRET}` },
    data: { tags: ['plans'] },
  });
}

async function mockPlanWrites(
  page: Page,
  request: APIRequestContext,
  locale: Locale,
) {
  const state: AdminPlanCatalog = { contractingEnabled: false, plans: [] };

  await page.route('**/v1/admin/plans**', async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers });
    if (route.request().method() === 'GET')
      return route.fulfill({ json: state, headers });
    const input = route.request().postDataJSON() as SaveAdminPlanBody;
    const plan: AdminPlan = {
      ...input,
      id: 'studio',
      kind: 'paid',
      syncStatus: 'synced',
      pendingOperation: null,
    };
    state.plans = [plan];
    await setPublicCatalog(request, locale, plan);
    await route.fulfill({ status: 201, json: plan, headers });
  });
}

async function fillPlan(form: Locator, locale: Locale) {
  const t = messages[locale].adminPlans;
  await form.locator('#name-en').fill('Studio');
  await form.locator('#description-en').fill('Practice tools for Studio.');
  await form.locator('#name-pt-BR').fill('Estúdio');
  await form.locator('#description-pt-BR').fill('Ferramentas para praticar.');
  await form.getByLabel(t.published, { exact: true }).check();
  await form.getByLabel(t.saleEnabled).check();
  await form.locator('#monthly-BRL').fill('2990');
  await form.locator('#monthly-USD').fill('500');
  await form.locator('#annual-BRL').fill('29900');
  await form.locator('#annual-USD').fill('5000');
}

async function createPlanJourney(
  page: Page,
  request: APIRequestContext,
  locale: Locale,
) {
  await mockAuthApi(page, { user: adminUser });
  await mockPlanWrites(page, request, locale);
  const copy = messages[locale];
  const t = copy.adminPlans;
  await page.goto(`/${locale}/admin`);
  await page.getByRole('link', { name: new RegExp(t.title) }).click();
  await page.getByRole('button', { name: t.newPlan, exact: true }).click();
  const form = page.getByRole('form', { name: t.editPlan });
  await fillPlan(form, locale);
  await form.getByRole('button', { name: t.save }).click();
  await expect(
    page.getByRole('button', { name: t.edit.replace('{name}', 'Studio') }),
  ).toBeVisible();
  await page.goto(`/${locale}/plans`);
  // Public tag invalidation serves one stale response while refreshing.
  await page.reload();
  const studio = page.getByRole('article', {
    name: locale === 'en' ? 'Studio' : 'Estúdio',
    exact: true,
  });
  await expect(studio).toBeVisible();
  const format = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: locale === 'en' ? 'USD' : 'BRL',
  });
  await expect(
    studio.getByText(
      copy.plans.annualCharge.replace(
        '{amount}',
        format.format(locale === 'en' ? 50 : 299),
      ),
      { exact: true },
    ),
  ).toBeVisible();
  await setPublicCatalog(request, locale);
}

export function registerAdminPlanJourneys() {
  for (const { locale, copy } of adminLocales) {
    test(`${locale}: creates a paid plan with independent prices without deployment`, async ({
      page,
      request,
    }) => {
      await createPlanJourney(page, request, locale);
    });
    test(`${locale}: refuses ordinary Users and returns visitors to sign-in`, async ({
      page,
    }) => {
      await mockAuthApi(page, { user: regularUser });
      await page.goto(`/${locale}/admin/plans`);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: `404 ${copy.notFound.title}`,
        }),
      ).toBeVisible();
      await mockAuthApi(page);
      await page.goto(`/${locale}/admin/plans`);
      await expect(page).toHaveURL(
        new RegExp(`/${locale}/sign-in\\?redirectTo=%2Fadmin%2Fplans$`),
      );
    });
  }
}

async function failedPlanWrites(page: Page) {
  const operationIds: string[] = [];
  await page.route('**/v1/admin/plans**', async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers });
    if (route.request().method() === 'GET')
      return route.fulfill({
        headers,
        json: { contractingEnabled: false, plans: [] },
      });
    const input = route.request().postDataJSON() as SaveAdminPlanBody;
    operationIds.push(input.operationId);
    if (operationIds.length === 1)
      return route.fulfill({
        status: 503,
        headers,
        json: {
          statusCode: 503,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Provider unavailable',
        },
      });
    return route.fulfill({
      status: 201,
      headers,
      json: {
        ...input,
        id: 'studio',
        kind: 'paid',
        syncStatus: 'synced',
        pendingOperation: null,
      },
    });
  });
  return operationIds;
}

export function registerPlanRetryJourney() {
  test('an interrupted plan save retries the preserved operation', async ({
    page,
  }) => {
    await mockAuthApi(page, { user: adminUser });
    const ids = await failedPlanWrites(page);
    const t = messages.en.adminPlans;
    await page.goto('/en/admin/plans');
    await page.getByRole('button', { name: t.newPlan, exact: true }).click();
    const form = page.getByRole('form', { name: t.editPlan });
    await fillPlan(form, 'en');
    await form.getByRole('button', { name: t.save }).click();
    await expect(form.getByRole('alert')).toContainText(
      messages.en.errors.SERVICE_UNAVAILABLE,
    );
    await expect(form.locator('#name-en')).toBeDisabled();
    await form.getByRole('button', { name: t.retry }).click();
    await expect(form).toHaveCount(0);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });
}

export function registerInvalidPlanPriceJourneys() {
  for (const { locale, copy } of adminLocales) {
    test(`${locale}: shows translated invalid-price validation`, async ({
      page,
    }) => {
      await mockAuthApi(page, { user: adminUser });
      const ids = await failedPlanWrites(page);
      const t = copy.adminPlans;
      await page.goto(`/${locale}/admin/plans`);
      await page.getByRole('button', { name: t.newPlan, exact: true }).click();
      const form = page.getByRole('form', { name: t.editPlan });
      await fillPlan(form, locale);
      for (const amount of ['0', '1.5']) {
        await form.locator('#monthly-USD').fill(amount);
        await form.getByRole('button', { name: t.save }).click();
        await expect(form.getByRole('alert')).toHaveText(t.invalid);
        expect(ids).toHaveLength(0);
      }
    });
  }
}
