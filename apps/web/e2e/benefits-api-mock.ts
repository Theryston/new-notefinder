import {
  type AdminBenefit,
  type BenefitPlans,
  setPlanBenefitsBodySchema,
  type WriteBenefitBody,
  writeBenefitBodySchema,
} from '@notefinder/contracts';
import type { Page, Route } from '@playwright/test';

const planCopy = (name: string) => ({
  en: { name, description: 'Plan description' },
  'pt-BR': { name, description: 'Plan description PT' },
});

async function reply(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': route.request().headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'content-type': 'application/json',
    },
    body: status === 204 ? '' : JSON.stringify(body),
  });
}

type BenefitStore = {
  benefits: Omit<AdminBenefit, 'plans'>[];
  plans: BenefitPlans;
  nextId: number;
  failReads: boolean;
  failWrites: boolean;
  calls: string[];
};
const withPlans = (
  store: BenefitStore,
  benefit: Omit<AdminBenefit, 'plans'>,
): AdminBenefit => ({
  ...benefit,
  plans: store.plans
    .filter((plan) => plan.benefitIds.includes(benefit.id))
    .map(({ id, copy }) => ({ id, copy })),
});

async function benefitRoute(route: Route, store: BenefitStore) {
  const request = route.request();
  const id = new URL(request.url()).pathname.split('/')[4];
  const method = request.method();
  if (method === 'GET') {
    const benefit = store.benefits.find((entry) => entry.id === id);
    return id
      ? reply(
          route,
          benefit ? withPlans(store, benefit) : { code: 'NOT_FOUND' },
          benefit ? 200 : 404,
        )
      : reply(
          route,
          store.benefits.map((entry) => withPlans(store, entry)),
        );
  }
  if (method === 'DELETE') {
    store.benefits = store.benefits.filter((entry) => entry.id !== id);
    for (const plan of store.plans)
      plan.benefitIds = plan.benefitIds.filter((entry) => entry !== id);
    return reply(route, null, 204);
  }
  const parsed = writeBenefitBodySchema.safeParse(request.postDataJSON());
  if (!parsed.success) return reply(route, { code: 'VALIDATION_FAILED' }, 400);
  const body: WriteBenefitBody = parsed.data;
  const next = { ...body, id: id ?? `benefit-${++store.nextId}` };
  store.benefits = [
    ...store.benefits.filter((entry) => entry.id !== next.id),
    next,
  ];
  return reply(route, withPlans(store, next), method === 'POST' ? 201 : 200);
}

export async function mockBenefitsApi(page: Page) {
  const store: BenefitStore = {
    benefits: [],
    plans: [
      { id: 'free', copy: planCopy('Free'), benefitIds: [] },
      { id: 'pro', copy: planCopy('Pro'), benefitIds: [] },
    ],
    nextId: 0,
    failReads: false,
    failWrites: false,
    calls: [],
  };
  await page.route(
    /\/v1\/admin\/(benefits|plan-benefits)(\/[^?]+)?(\?.*)?$/,
    async (route) => {
      const request = route.request();
      const method = request.method();
      if (method === 'OPTIONS') return reply(route, null, 204);
      store.calls.push(`${method} ${new URL(request.url()).pathname}`);
      if (
        (store.failReads && method === 'GET') ||
        (store.failWrites && method !== 'GET')
      )
        return reply(route, { code: 'INTERNAL_ERROR' }, 500);
      if (new URL(request.url()).pathname.includes('/admin/benefits'))
        return benefitRoute(route, store);
      if (method === 'GET') return reply(route, store.plans);
      const id = new URL(request.url()).pathname.split('/')[4];
      const plan = store.plans.find((entry) => entry.id === id);
      if (!plan) return reply(route, { code: 'NOT_FOUND' }, 404);
      plan.benefitIds = setPlanBenefitsBodySchema.parse(
        request.postDataJSON(),
      ).benefitIds;
      return reply(route, plan);
    },
  );
  return store;
}
