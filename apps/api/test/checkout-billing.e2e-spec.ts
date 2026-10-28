import { eq } from 'drizzle-orm';
import {
  planCatalogSettings,
  planPrices,
  plans,
} from '../src/database/schema/plans.js';
import { StripeBillingService } from '../src/integrations/stripe/stripe-billing.service.js';
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

const ROOT = '/v1/me/subscription';
describe('Stripe Checkout contracts over HTTP (e2e)', () => {
  let app: TestApp;
  const fake = billingProvider();
  beforeAll(async () => {
    app = await createTestApp({
      env: { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET },
      override: (builder) =>
        builder.overrideProvider(StripeBillingService).useValue(fake.provider),
    });
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(app.db);
    await billingCatalog(app);
    vi.clearAllMocks();
    fake.sessions.clear();
    fake.contracts.clear();
  });
  it.each([
    ['en', 'monthly', 'USD', 350],
    ['en', 'annual', 'USD', 3500],
    ['pt-BR', 'monthly', 'BRL', 1990],
    ['pt-BR', 'annual', 'BRL', 19900],
  ])(
    'contracts the %s %s offer without granting membership from a redirect',
    async (locale, cycle, currency, amount) => {
      const { client } = await billingUser(app);
      await client
        .post(`${ROOT}/checkout`)
        .send(checkoutBody(String(locale), String(cycle)))
        .expect(201);
      const response = await client.get(`${ROOT}?locale=en`).expect(200);
      expect(response.body.subscription).toMatchObject({
        cycle,
        currency,
        amount,
        status: 'pending',
        paidMembership: false,
      });
      const session = [...fake.sessions.values()][0];
      if (!session) throw new Error('Expected checkout');
      const provider = paidProvider(session, {
        amount: Number(amount),
        currency: String(currency).toLowerCase(),
        price: `price_${String(currency).toLowerCase()}_${cycle}`,
      });
      fake.contracts.set(provider.id, provider);
      const event = signedEvent(session.customer);
      await app.http
        .post('/v1/billing/stripe-webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', event.signature)
        .send(event.body)
        .expect(200);
      const confirmed = await client.get(`${ROOT}?locale=pt-BR`).expect(200);
      expect(confirmed.body.subscription).toMatchObject({
        currency,
        amount,
        status: 'confirmed',
        paidMembership: true,
        providerStatus: 'active',
      });
      expect(confirmed.body.subscription.currentPeriodEnd).toEqual(
        expect.any(String),
      );
      expect(
        (await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201))
          .body,
      ).toEqual({ action: 'manage' });
    },
  );
  it('serializes concurrent checkout requests and reuses a pending session', async () => {
    const { client } = await billingUser(app);
    const results = await Promise.all([
      client.post(`${ROOT}/checkout`).send(checkoutBody()),
      client.post(`${ROOT}/checkout`).send(checkoutBody()),
    ]);
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    expect(results[0]?.body).toEqual(results[1]?.body);
    expect(fake.provider.createCheckout).toHaveBeenCalledTimes(1);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    expect(fake.provider.createCheckout).toHaveBeenCalledTimes(1);
  });
  it('rejects stale, disabled, incomplete and browser-priced offers before creating checkout', async () => {
    const { client } = await billingUser(app);
    for (const body of [
      { ...checkoutBody(), offerId: 'stale' },
      { ...checkoutBody(), cycle: 'weekly' },
      { ...checkoutBody(), amount: 1 },
      { ...checkoutBody(), customer: 'cus_other' },
      { ...checkoutBody(), returnUrl: 'https://evil.example' },
      { ...checkoutBody(), comingSoonAcknowledged: false },
    ])
      expect(
        (await client.post(`${ROOT}/checkout`).send(body)).status,
      ).toBeGreaterThanOrEqual(400);
    await app.db
      .update(planPrices)
      .set({ stripePriceId: null })
      .where(eq(planPrices.id, 'brl-monthly'));
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(409);
    await app.db
      .update(planPrices)
      .set({ stripePriceId: 'restored' })
      .where(eq(planPrices.id, 'brl-monthly'));
    await app.db
      .update(plans)
      .set({ published: false })
      .where(eq(plans.id, 'pro'));
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(409);
    await app.db
      .update(plans)
      .set({ published: true })
      .where(eq(plans.id, 'pro'));
    await app.db.update(planCatalogSettings).set({ contractingEnabled: false });
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(409);
    expect(fake.provider.createCheckout).not.toHaveBeenCalled();
  });
  it('preserves the attempt key after a provider outage and allows a new attempt only after confirmed expiry', async () => {
    const { client } = await billingUser(app);
    fake.provider.createCheckout.mockRejectedValueOnce(
      new Error('network interruption'),
    );
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(500);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    expect(fake.provider.createCheckout.mock.calls[0]?.[0].id).toBe(
      fake.provider.createCheckout.mock.calls[1]?.[0].id,
    );
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    session.status = 'expired';
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    expect(fake.provider.createCheckout.mock.calls[2]?.[0].id).not.toBe(
      fake.provider.createCheckout.mock.calls[1]?.[0].id,
    );
  });
  it('keeps another User private and requires completed username onboarding', async () => {
    const { client } = await billingUser(app);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    const other = await billingUser(app);
    expect((await other.client.get(ROOT).expect(200)).body).toEqual({
      subscription: null,
    });
    await other.client.get(`${ROOT}/someone-else`).expect(404);
    const missing = await billingUser(app, null);
    await missing.client
      .post(`${ROOT}/checkout`)
      .send(checkoutBody())
      .expect(403);
    await app.http.post(`${ROOT}/checkout`).send(checkoutBody()).expect(401);
  });
});
