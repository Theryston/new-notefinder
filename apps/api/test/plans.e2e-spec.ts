import { readFile } from 'node:fs/promises';
import { planCatalogSchema } from '@vozzify/contracts';
import { eq, sql } from 'drizzle-orm';
import {
  benefits,
  planBenefits,
  planPrices,
  plans,
} from '../src/database/schema/plans.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';

describe('Public plan catalog (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    const migration = await readFile(
      new URL('../drizzle/0033_hot_nitro.sql', import.meta.url),
      'utf8',
    );
    const seed = migration.split('-- Initial public plan catalog.')[1];
    if (!seed) throw new Error('Initial plan catalog migration is missing');
    await testApp.db.execute(sql.raw(`-- Initial public plan catalog.${seed}`));
  });

  it('lets a visitor compare persisted Free and Pro offers in English', async () => {
    const response = await testApp.http.get('/v1/plans?locale=en').expect(200);
    expect(response.body).toMatchObject({
      currency: 'USD',
      plans: [
        { id: 'free', name: 'Free', kind: 'free', offers: [] },
        {
          id: 'pro',
          name: 'Pro',
          kind: 'paid',
          trialDays: 0,
          offers: [
            { cycle: 'monthly', amount: 350 },
            { cycle: 'annual', amount: 3500 },
          ],
        },
      ],
    });
    expect(response.headers['cache-control']).toBe(
      'public, max-age=0, must-revalidate',
    );
    expect(response.body.plans[1].benefits).toHaveLength(7);
    expect(
      response.body.plans[1].benefits.every(
        (benefit: { status: string }) => benefit.status === 'coming-soon',
      ),
    ).toBe(true);
  });
  it('shows independent Brazilian offers and persisted Portuguese content', async () => {
    const response = await testApp.http
      .get('/v1/plans?locale=pt-BR')
      .expect(200);
    const catalog = planCatalogSchema.parse(response.body);
    expect(catalog.currency).toBe('BRL');
    expect(catalog.plans.map((plan) => plan.name)).toEqual(['Grátis', 'Pro']);
    expect(
      catalog.plans[1]?.offers.map(({ cycle, amount }) => ({ cycle, amount })),
    ).toEqual([
      { cycle: 'monthly', amount: 1990 },
      { cycle: 'annual', amount: 19900 },
    ]);
    expect(catalog.plans[0]?.benefits.map((benefit) => benefit.id)).toEqual([
      'track-search',
      'track-requests',
      'unlimited-singing',
      'vocal-notes',
      'basic-pitch-feedback',
    ]);
    expect(
      catalog.plans[0]?.benefits.every(
        (benefit) => benefit.status === 'available',
      ),
    ).toBe(true);
  });

  it('defaults to English and rejects unsupported locales', async () => {
    const response = await testApp.http.get('/v1/plans').expect(200);
    expect(response.body.currency).toBe('USD');
    const invalid = await testApp.http.get('/v1/plans?locale=fr').expect(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
  });

  it('omits hidden benefits and reflects global status changes', async () => {
    await testApp.db
      .update(benefits)
      .set({ status: 'hidden' })
      .where(eq(benefits.id, 'ad-free'));
    await testApp.db
      .update(benefits)
      .set({ status: 'available' })
      .where(eq(benefits.id, 'difficulty-map'));
    const response = await testApp.http.get('/v1/plans').expect(200);
    const pro = planCatalogSchema
      .parse(response.body)
      .plans.find((plan) => plan.id === 'pro');
    expect(pro?.benefits).toHaveLength(6);
    expect(pro?.benefits.some((benefit) => benefit.id === 'ad-free')).toBe(
      false,
    );
    expect(
      pro?.benefits.find((benefit) => benefit.id === 'difficulty-map')?.status,
    ).toBe('available');
  });

  it.each([
    [['monthly'], ['monthly']],
    [['annual'], ['annual']],
    [
      ['monthly', 'annual'],
      ['monthly', 'annual'],
    ],
    [[], []],
  ] as const)('offers only enabled cycles %j', async (enabled, expected) => {
    await testApp.db
      .update(plans)
      .set({ enabledCycles: [...enabled] })
      .where(eq(plans.id, 'pro'));
    const response = await testApp.http.get('/v1/plans').expect(200);
    const pro = planCatalogSchema
      .parse(response.body)
      .plans.find((plan) => plan.id === 'pro');
    expect(pro?.offers.map((offer) => offer.cycle)).toEqual(expected);
  });

  it('withholds an incomplete cycle in both locales without substituting currency', async () => {
    await testApp.db
      .delete(planPrices)
      .where(eq(planPrices.id, 'pro-annual-brl'));
    for (const locale of ['en', 'pt-BR']) {
      const response = await testApp.http
        .get(`/v1/plans?locale=${locale}`)
        .expect(200);
      const pro = planCatalogSchema
        .parse(response.body)
        .plans.find((plan) => plan.id === 'pro');
      expect(pro?.offers.map((offer) => offer.cycle)).toEqual(['monthly']);
    }
  });

  it('ignores historical prices, unpublished plans and prices on Free', async () => {
    await testApp.db.insert(planPrices).values([
      {
        id: 'old-price',
        planId: 'pro',
        cycle: 'monthly',
        currency: 'USD',
        amount: 200,
        current: false,
      },
      {
        id: 'free-price',
        planId: 'free',
        cycle: 'monthly',
        currency: 'USD',
        amount: 100,
      },
    ]);
    await testApp.db
      .update(plans)
      .set({ published: false })
      .where(eq(plans.id, 'pro'));
    const response = await testApp.http.get('/v1/plans').expect(200);
    expect(planCatalogSchema.parse(response.body).plans).toMatchObject([
      { id: 'free', offers: [] },
    ]);
    await testApp.db
      .update(plans)
      .set({ published: true })
      .where(eq(plans.id, 'pro'));
    const restored = await testApp.http.get('/v1/plans').expect(200);
    expect(
      planCatalogSchema
        .parse(restored.body)
        .plans[1]?.offers.map((offer) => offer.amount),
    ).toEqual([350, 3500]);
  });

  it('keeps configured plan and benefit ordering and reads backend copy', async () => {
    await testApp.db
      .update(plans)
      .set({ displayOrder: -1 })
      .where(eq(plans.id, 'pro'));
    await testApp.db
      .update(planBenefits)
      .set({ position: 99 })
      .where(eq(planBenefits.id, 'pro-advanced-scoring'));
    await testApp.db
      .update(plans)
      .set({
        copy: {
          en: {
            name: 'Studio',
            description: 'A new persisted plan description.',
          },
          'pt-BR': { name: 'Studio', description: 'A localized description.' },
        },
      })
      .where(eq(plans.id, 'pro'));
    const response = await testApp.http.get('/v1/plans').expect(200);
    const catalog = planCatalogSchema.parse(response.body);
    expect(catalog.plans.map((plan) => plan.id)).toEqual(['pro', 'free']);
    expect(catalog.plans[0]?.name).toBe('Studio');
    expect(catalog.plans[0]?.benefits.at(-1)?.id).toBe('advanced-scoring');
  });

  it('returns an empty comparison when nothing is published', async () => {
    await testApp.db.update(plans).set({ published: false });
    const response = await testApp.http.get('/v1/plans').expect(200);
    expect(response.body).toEqual({ currency: 'USD', plans: [] });
  });

  it('refuses incomplete localized catalog content instead of falling back silently', async () => {
    await testApp.db.execute(
      sql`update plans set copy = '{"en":{"name":"Pro","description":"English only"}}'::jsonb where id = 'pro'`,
    );
    const response = await testApp.http
      .get('/v1/plans?locale=pt-BR')
      .expect(500);
    expect(response.body.code).toBe('INTERNAL_ERROR');
  });
});
