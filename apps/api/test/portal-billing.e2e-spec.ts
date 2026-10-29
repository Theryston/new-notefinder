import { eq } from 'drizzle-orm';
import { plans } from '../src/database/schema/plans.js';
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
describe('Customer portal (e2e)', () => {
  let app: TestApp;
  const fake = billingProvider();
  const createPortal = vi.fn(
    async () => 'https://billing.stripe.com/session/test',
  );
  beforeAll(async () => {
    app = await createTestApp({
      env: { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET },
      override: (builder) =>
        builder
          .overrideProvider(StripeBillingService)
          .useValue({ ...fake.provider, createPortal }),
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
  });
  it('requires authentication and an existing subscription, and rejects arbitrary return destinations', async () => {
    await app.http.post(`${ROOT}/portal`).send({ locale: 'en' }).expect(401);
    const { client } = await billingUser(app);
    await client.post(`${ROOT}/portal`).send({ locale: 'en' }).expect(409);
    await client
      .post(`${ROOT}/portal`)
      .send({ locale: 'en', returnUrl: 'https://evil.example' })
      .expect(400);
    expect(createPortal).not.toHaveBeenCalled();
  });
  it('uses only the authenticated User customer and a trusted locale', async () => {
    const { client, user } = await billingUser(app);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(session);
    fake.contracts.set(provider.id, provider);
    const event = signedEvent(session.customer);
    await app.http
      .post('/v1/billing/stripe-webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', event.signature)
      .send(event.body)
      .expect(200);
    const response = await client
      .post(`${ROOT}/portal`)
      .send({ locale: 'pt-BR' })
      .expect(201);
    expect(response.body).toEqual({
      url: 'https://billing.stripe.com/session/test',
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(createPortal).toHaveBeenCalledWith(`cus_${user.id}`, 'pt-BR');
  });
  it('retains the historical contract across retirement, renewal and cancellation through its exact deadline', async () => {
    const { client } = await billingUser(app);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(session);
    fake.contracts.set(provider.id, provider);
    const deliver = async (event: ReturnType<typeof signedEvent>) =>
      app.http
        .post('/v1/billing/stripe-webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', event.signature)
        .send(event.body)
        .expect(200);
    await deliver(signedEvent(session.customer));
    await app.db
      .update(plans)
      .set({ saleEnabled: false })
      .where(eq(plans.id, 'pro'));
    const other = await billingUser(app);
    await other.client
      .post(`${ROOT}/checkout`)
      .send(checkoutBody())
      .expect(409);
    const item = provider.items.data[0];
    if (!item) throw new Error('Expected subscription item');
    item.current_period_end = Math.floor(Date.now() / 1000) + 60;
    await deliver(signedEvent(session.customer, 'evt_renewal', 'invoice.paid'));
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({ planName: 'Pro', amount: 350, paidMembership: true });
    provider.cancel_at_period_end = true;
    const cancellation = signedEvent(
      session.customer,
      'evt_cancel',
      'customer.subscription.updated',
    );
    await deliver(cancellation);
    const calls = fake.provider.getSubscription.mock.calls.length;
    await deliver(cancellation);
    expect(fake.provider.getSubscription).toHaveBeenCalledTimes(calls);
    const end = item.current_period_end * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(end - 1);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({
      cancelAtPeriodEnd: true,
      paidMembership: true,
      currentPeriodEnd: new Date(end).toISOString(),
    });
    vi.spyOn(Date, 'now').mockReturnValue(end);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.paidMembership,
    ).toBe(false);
    vi.spyOn(Date, 'now').mockReturnValue(end + 1);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.paidMembership,
    ).toBe(false);
    vi.restoreAllMocks();
  });
});
