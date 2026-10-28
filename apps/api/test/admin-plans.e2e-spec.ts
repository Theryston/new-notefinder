import { adminPlanCatalogSchema, planCatalogSchema } from '@vozzify/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { planPrices, plans } from '../src/database/schema/plans.js';
import { users } from '../src/database/schema/users.js';
import { StripeCatalogService } from '../src/integrations/stripe/stripe-catalog.service.js';
import { createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';

const ROOT = '/v1/admin/plans';
const body = (operationId = crypto.randomUUID()) => ({
  operationId,
  copy: {
    en: { name: 'Studio', description: 'Practice with Studio.' },
    'pt-BR': { name: 'Estúdio', description: 'Pratique com Estúdio.' },
  },
  displayOrder: 2,
  published: true,
  saleEnabled: true,
  enabledCycles: ['monthly', 'annual'],
  prices: [
    { cycle: 'monthly', currency: 'BRL', amount: 2990 },
    { cycle: 'monthly', currency: 'USD', amount: 500 },
    { cycle: 'annual', currency: 'BRL', amount: 29900 },
    { cycle: 'annual', currency: 'USD', amount: 5000 },
  ],
});

describe('Admin paid plan catalog (e2e)', () => {
  let app: TestApp;
  const stripe = { syncProduct: vi.fn(), ensurePrice: vi.fn() };
  beforeAll(async () => {
    app = await createTestApp({
      override: (builder) =>
        builder.overrideProvider(StripeCatalogService).useValue(stripe),
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(app.db);
    stripe.syncProduct.mockReset().mockResolvedValue('prod_studio');
    stripe.ensurePrice
      .mockReset()
      .mockImplementation(
        async (input: { key: string }) => `price_${input.key}`,
      );
  });
  const admin = async () => {
    const client = createAuthClient(app);
    const user = await createUser(app.db, { role: 'ADMIN' });
    await createCredentialAccount(app.db, user);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    return client;
  };
  it('creates synchronized independent prices and reflects localized public offers', async () => {
    const client = await admin();
    const created = await client.post(ROOT).send(body()).expect(201);
    expect(created.body).toMatchObject({
      kind: 'paid',
      published: true,
      syncStatus: 'synced',
    });
    const catalog = planCatalogSchema.parse(
      (await app.http.get('/v1/plans?locale=pt-BR').expect(200)).body,
    );
    expect(catalog.plans[0]).toMatchObject({
      name: 'Estúdio',
      offers: [
        { cycle: 'monthly', amount: 2990 },
        { cycle: 'annual', amount: 29900 },
      ],
    });
    expect(stripe.ensurePrice).toHaveBeenCalledTimes(4);
    const listed = adminPlanCatalogSchema.parse(
      (await client.get(ROOT).expect(200)).body,
    );
    expect(listed.plans[0]?.prices).toHaveLength(4);
  });
});

describe('Admin catalog permission and recovery policies (e2e)', () => {
  let app: TestApp;
  const stripe = { syncProduct: vi.fn(), ensurePrice: vi.fn() };
  beforeAll(async () => {
    app = await createTestApp({
      override: (builder) =>
        builder.overrideProvider(StripeCatalogService).useValue(stripe),
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(app.db);
    stripe.syncProduct.mockReset().mockResolvedValue('prod_test');
    stripe.ensurePrice
      .mockReset()
      .mockImplementation(
        async (input: { key: string }) => `price_${input.key}`,
      );
  });
  async function signedIn(role: 'ADMIN' | 'USER') {
    const client = createAuthClient(app);
    const user = await createUser(app.db, { role });
    await createCredentialAccount(app.db, user);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    return client;
  }
  it.each(['visitor', 'USER'] as const)(
    'refuses %s access on every admin operation',
    async (role) => {
      const client =
        role === 'visitor'
          ? request(app.app.getHttpServer())
          : await signedIn(role);
      const status = role === 'visitor' ? 401 : 403;
      await client.get(ROOT).expect(status);
      await client.post(ROOT).send(body()).expect(status);
      await client.put(`${ROOT}/missing`).send(body()).expect(status);
      await client
        .put(`${ROOT}/contracting`)
        .send({ contractingEnabled: true })
        .expect(status);
    },
  );
  it.each([[['monthly']], [['annual']], [['monthly', 'annual']]])(
    'publishes only configured cycles %j with independent currency prices',
    async (cycles) => {
      const client = await signedIn('ADMIN');
      const input = body();
      input.enabledCycles = cycles;
      input.prices = input.prices.filter((price) =>
        cycles.includes(price.cycle),
      );
      await client.post(ROOT).send(input).expect(201);
      for (const locale of ['en', 'pt-BR']) {
        const response = await app.http
          .get(`/v1/plans?locale=${locale}`)
          .expect(200);
        expect(
          response.body.plans[0].offers.map(
            (offer: { cycle: string }) => offer.cycle,
          ),
        ).toEqual(cycles);
      }
    },
  );
  it('rejects incomplete publication, invalid money, duplicate offers and missing translations', async () => {
    const client = await signedIn('ADMIN');
    const input = body();
    for (const invalid of [
      { ...input, prices: input.prices.slice(1) },
      { ...input, enabledCycles: [] },
      { ...input, enabledCycles: ['monthly', 'monthly'] },
      { ...input, prices: [input.prices[0], ...input.prices.slice(0, 3)] },
      {
        ...input,
        prices: input.prices.map((price) => ({ ...price, amount: 0 })),
      },
      {
        ...input,
        prices: input.prices.map((price) => ({ ...price, amount: 1.5 })),
      },
      { ...input, copy: { en: input.copy.en } },
    ])
      await client.post(ROOT).send(invalid).expect(400);
    expect(stripe.syncProduct).not.toHaveBeenCalled();
  });
  it('preserves partial success and retries the immutable operation after a restart', async () => {
    const client = await signedIn('ADMIN');
    const input = body();
    stripe.ensurePrice
      .mockResolvedValueOnce('price_first_success')
      .mockRejectedValueOnce(new Error('Stripe unavailable'));
    await client.post(ROOT).send(input).expect(503);
    expect((await app.http.get('/v1/plans').expect(200)).body.plans).toEqual(
      [],
    );
    const listing = adminPlanCatalogSchema.parse(
      (await client.get(ROOT).expect(200)).body,
    );
    const pending = listing.plans[0];
    expect(pending).toMatchObject({
      published: false,
      syncStatus: 'failed',
      pendingOperation: input,
    });
    await client
      .post(ROOT)
      .send({ ...input, displayOrder: 10 })
      .expect(409);
    await client.put(`${ROOT}/${pending?.id}`).send(body()).expect(409);
    await client.put(`${ROOT}/${pending?.id}`).send(input).expect(200);
    const count = stripe.ensurePrice.mock.calls.length;
    await client.post(ROOT).send(input).expect(201);
    expect(stripe.ensurePrice).toHaveBeenCalledTimes(count);
    expect(
      (await client.get(ROOT).expect(200)).body.plans[0].pendingOperation,
    ).toBeNull();
  });
  it('serializes concurrent submissions without creating duplicate offers', async () => {
    const client = await signedIn('ADMIN');
    const input = body();
    const rival = createAuthClient(app);
    await signIn(rival, {
      email: (await app.db.select().from(users))[0]?.email ?? '',
      password: DEFAULT_PASSWORD,
    }).expect(200);
    let release: () => void = () => {};
    let entered: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    stripe.syncProduct.mockImplementationOnce(async () => {
      entered();
      await waiting;
      return 'prod_studio';
    });
    const first = client
      .post(ROOT)
      .send(input)
      .then((response) => response);
    await started;
    await rival.post(ROOT).send(input).expect(409);
    await rival
      .put(`${ROOT}/plan-${input.operationId}`)
      .send(body())
      .expect(409);
    release();
    expect((await first).status).toBe(201);
    expect(stripe.ensurePrice).toHaveBeenCalledTimes(4);
  });

  it('retains historical price references, disables cycles, retires plans and controls new sales', async () => {
    const client = await signedIn('ADMIN');
    const input = body();
    const created = await client.post(ROOT).send(input).expect(201);
    const id = created.body.id as string;
    const publicPlan = async () =>
      (await app.http.get('/v1/plans').expect(200)).body.plans[0];
    expect((await publicPlan()).saleAvailable).toBe(false);
    await client
      .put(`${ROOT}/contracting`)
      .send({ contractingEnabled: true })
      .expect(200);
    expect((await publicPlan()).saleAvailable).toBe(true);
    const edited = {
      ...body(),
      enabledCycles: ['annual'],
      prices: input.prices.map((price) => ({
        ...price,
        amount: price.amount + 100,
      })),
    };
    await client.put(`${ROOT}/${id}`).send(edited).expect(200);
    expect((await publicPlan()).offers).toMatchObject([
      { cycle: 'annual', amount: 5100 },
    ]);
    const samePrices = {
      ...edited,
      operationId: crypto.randomUUID(),
      saleEnabled: false,
    };
    await client.put(`${ROOT}/${id}`).send(samePrices).expect(200);
    expect((await publicPlan()).saleAvailable).toBe(false);
    await client
      .put(`${ROOT}/${id}`)
      .send({
        ...samePrices,
        operationId: crypto.randomUUID(),
        published: false,
      })
      .expect(200);
    expect((await app.http.get('/v1/plans').expect(200)).body.plans).toEqual(
      [],
    );
    expect(
      (await client.get(ROOT).expect(200)).body.plans[0].prices,
    ).toHaveLength(4);
    const historical = await app.db
      .select()
      .from(planPrices)
      .where(eq(planPrices.planId, id));
    expect(historical).toHaveLength(8);
    expect(
      historical
        .filter((price) => !price.current)
        .every((price) => price.stripePriceId !== null),
    ).toBe(true);
  });
  it('rejects unknown plans and preserves Free as a comparison entry', async () => {
    const client = await signedIn('ADMIN');
    await client.put(`${ROOT}/missing`).send(body()).expect(404);
    await app.db
      .insert(plans)
      .values({ id: 'free', kind: 'free', copy: body().copy });
    await client.put(`${ROOT}/free`).send(body()).expect(400);
  });
});
