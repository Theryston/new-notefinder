import { eq } from 'drizzle-orm';
import { plans } from '../src/database/schema/plans.js';
import { StripeBillingService } from '../src/integrations/stripe/stripe-billing.service.js';
import { StripeCatalogService } from '../src/integrations/stripe/stripe-catalog.service.js';
import { createAuthClient, signIn } from './utils/auth.js';
import {
  billingCatalog,
  billingProvider,
  billingUser,
  checkoutBody,
  paidProvider,
  signedEvent,
  WEBHOOK_SECRET,
} from './utils/billing-fixture.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';

const ROOT = '/v1/me/subscription';
describe('Card-backed trials over HTTP', () => {
  let app: TestApp;
  const fake = billingProvider();
  beforeAll(async () => {
    app = await createTestApp({
      env: { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET },
      override: (builder) =>
        builder
          .overrideProvider(StripeBillingService)
          .useValue(fake.provider)
          .overrideProvider(StripeCatalogService)
          .useValue({
            syncProduct: async () => 'prod_trial',
            ensurePrice: async (input: { key: string }) => `price_${input.key}`,
          }),
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(app.db);
    await billingCatalog(app);
    await app.db
      .update(plans)
      .set({ trialDays: 14 })
      .where(eq(plans.id, 'pro'));
    vi.clearAllMocks();
    fake.sessions.clear();
    fake.contracts.clear();
  });
  it.each(['monthly', 'annual'])(
    'reserves a trial for %s and consumes it only on provider confirmation',
    async (cycle) => {
      const { client } = await billingUser(app);
      expect(
        (await client.get(`${ROOT}/trial-eligibility`).expect(200)).body,
      ).toEqual({ eligible: true });
      await client
        .post(`${ROOT}/checkout`)
        .send({ ...checkoutBody('en', cycle), trialDays: 14 })
        .expect(201);
      expect(
        (await client.get(`${ROOT}/trial-eligibility`).expect(200)).body,
      ).toEqual({ eligible: true });
      expect(fake.provider.createCheckout.mock.calls[0]?.[0]).toMatchObject({
        trialDays: 14,
      });
      await app.db
        .update(plans)
        .set({ trialDays: 3 })
        .where(eq(plans.id, 'pro'));
      await client
        .post(`${ROOT}/checkout`)
        .send({ ...checkoutBody('en', cycle), trialDays: 14 })
        .expect(201);
      expect(fake.provider.createCheckout).toHaveBeenCalledTimes(1);
      const session = [...fake.sessions.values()][0];
      if (!session) throw new Error('Expected checkout');
      const provider = paidProvider(session, {
        amount: cycle === 'annual' ? 3500 : 350,
        price: `price_usd_${cycle}`,
      });
      const end = Math.floor(Date.now() / 1000) + 14 * 86400;
      provider.status = 'trialing';
      provider.latest_invoice = null;
      provider.default_payment_method = 'pm_card';
      provider.trial_end = end;
      provider.trial_start = end - 14 * 86400;
      const item = provider.items.data[0];
      if (!item) throw new Error('Expected subscription item');
      item.current_period_end = end;
      fake.contracts.set(provider.id, provider);
      await deliverEvent(app, session.customer);
      expect(
        (await client.get(ROOT).expect(200)).body.subscription,
      ).toMatchObject({
        providerStatus: 'trialing',
        status: 'confirmed',
        paidMembership: true,
      });
      expect(
        (await client.get(`${ROOT}/trial-eligibility`).expect(200)).body,
      ).toEqual({ eligible: false });
    },
  );
  it('rejects undisclosed or stale trial terms before opening Checkout', async () => {
    const { client } = await billingUser(app);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(409);
    expect(fake.provider.createCheckout).not.toHaveBeenCalled();
  });
  it('does not consume a trial without a confirmed card', async () => {
    const { client } = await billingUser(app);
    await client
      .post(`${ROOT}/checkout`)
      .send({ ...checkoutBody(), trialDays: 14 })
      .expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(session);
    provider.status = 'trialing';
    provider.latest_invoice = null;
    provider.trial_end = provider.items.data[0]?.current_period_end;
    provider.trial_start = (provider.trial_end ?? 0) - 14 * 86400;
    provider.default_payment_method = null;
    fake.contracts.set(provider.id, provider);
    await deliverEvent(app, session.customer);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.paidMembership,
    ).toBe(false);
    expect(
      (await client.get(`${ROOT}/trial-eligibility`).expect(200)).body.eligible,
    ).toBe(true);
  });
  it('keeps trial usage after cancellation and allows a return with immediate billing', async () => {
    const { client } = await billingUser(app);
    await client
      .post(`${ROOT}/checkout`)
      .send({ ...checkoutBody(), trialDays: 14 })
      .expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(session);
    provider.status = 'trialing';
    provider.latest_invoice = null;
    provider.default_payment_method = 'pm_card';
    provider.trial_end = Math.floor(Date.now() / 1000) + 86400;
    provider.trial_start = provider.trial_end - 14 * 86400;
    const item = provider.items.data[0];
    if (!item) throw new Error('Expected subscription item');
    item.current_period_end = provider.trial_end;
    fake.contracts.set(provider.id, provider);
    await deliverEvent(app, session.customer);
    provider.status = 'canceled';
    provider.cancel_at_period_end = true;
    item.current_period_end = Math.floor(Date.now() / 1000) - 1;
    await deliverEvent(app, session.customer);
    expect(
      (await client.get(`${ROOT}/trial-eligibility`).expect(200)).body.eligible,
    ).toBe(false);
    await client
      .post(`${ROOT}/checkout`)
      .send(checkoutBody('en', 'annual'))
      .expect(201);
    expect(fake.provider.createCheckout.mock.calls.at(-1)?.[0]).toMatchObject({
      trialDays: 0,
      price: 'price_usd_annual',
    });
  });
  it('does not activate a provider trial before Checkout completes', async () => {
    const { client } = await billingUser(app);
    await client
      .post(`${ROOT}/checkout`)
      .send({ ...checkoutBody(), trialDays: 14 })
      .expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(session);
    session.status = 'open';
    provider.status = 'trialing';
    provider.latest_invoice = null;
    provider.default_payment_method = 'pm_card';
    provider.trial_end = Math.floor(Date.now() / 1000) + 86400;
    provider.trial_start = provider.trial_end - 14 * 86400;
    const item = provider.items.data[0];
    if (!item) throw new Error('Expected item');
    item.current_period_end = provider.trial_end;
    fake.contracts.set(provider.id, provider);
    await deliverEvent(app, session.customer);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.paidMembership,
    ).toBe(false);
    expect(
      (await client.get(`${ROOT}/trial-eligibility`).expect(200)).body.eligible,
    ).toBe(true);
  });
  it('persists administrator trial-day changes in the public catalog', async () => {
    await app.db.update(plans).set({ trialDays: 0 }).where(eq(plans.id, 'pro'));
    const user = await createUser(app.db, { role: 'ADMIN' });
    await createCredentialAccount(app.db, user);
    const client = createAuthClient(app);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    const body = {
      operationId: crypto.randomUUID(),
      copy: {
        en: { name: 'Pro', description: 'Support.' },
        'pt-BR': { name: 'Pro', description: 'Support.' },
      },
      displayOrder: 0,
      published: true,
      saleEnabled: true,
      enabledCycles: ['monthly', 'annual'],
      trialDays: 14,
      prices: [
        { cycle: 'monthly', currency: 'USD', amount: 350 },
        { cycle: 'monthly', currency: 'BRL', amount: 1990 },
        { cycle: 'annual', currency: 'USD', amount: 3500 },
        { cycle: 'annual', currency: 'BRL', amount: 19900 },
      ],
    };
    const updated = await client
      .put('/v1/admin/plans/pro')
      .send(body)
      .expect(200);
    expect(updated.body.trialDays).toBe(14);
    const catalog = (await app.http.get('/v1/plans?locale=en').expect(200))
      .body;
    expect(catalog.plans[0].trialDays).toBe(14);
    await client
      .put('/v1/admin/plans/pro')
      .send({ ...body, operationId: crypto.randomUUID(), trialDays: -1 })
      .expect(400);
  });
});

async function deliverEvent(app: TestApp, customer: string) {
  const event = signedEvent(customer);
  await app.http
    .post('/v1/billing/stripe-webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', event.signature)
    .send(event.body)
    .expect(200);
}
