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
describe('Signed Stripe webhook confirmation (e2e)', () => {
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
  const deliver = (event: ReturnType<typeof signedEvent>) =>
    app.http
      .post('/v1/billing/stripe-webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', event.signature)
      .send(event.body);
  it('rejects invalid, missing, expired and body-mutated signatures through shared app setup', async () => {
    const event = signedEvent('cus_unknown');
    await app.http
      .post('/v1/billing/stripe-webhook')
      .send(JSON.parse(event.body))
      .expect(400);
    await deliver({
      ...event,
      signature: event.signature.replace('v1=', 'v1=0'),
    }).expect(400);
    await deliver({
      ...event,
      signature: event.signature.replace(/t=\d+/, 't=1'),
    }).expect(400);
    await deliver({ ...event, body: `${event.body} ` }).expect(400);
    await deliver(event).expect(200);
  });
  it('does not grant initial incomplete/failed payments, then confirms once and ignores stale event payloads', async () => {
    const { client } = await billingUser(app);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(session);
    provider.status = 'incomplete';
    provider.latest_invoice = { status: 'open', amount_paid: 0 };
    fake.contracts.set(provider.id, provider);
    await deliver(signedEvent(session.customer)).expect(200);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({ paidMembership: false, status: 'pending' });
    provider.status = 'past_due';
    await deliver(signedEvent(session.customer)).expect(200);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({ paidMembership: false, status: 'unsuccessful' });
    provider.status = 'active';
    provider.latest_invoice = { status: 'paid', amount_paid: 350 };
    const event = signedEvent(session.customer);
    await deliver(event).expect(200);
    const calls = fake.provider.getSubscription.mock.calls.length;
    await deliver(event).expect(200);
    expect(fake.provider.getSubscription).toHaveBeenCalledTimes(calls);
    await deliver(
      signedEvent(session.customer, 'evt_old', 'invoice.payment_failed'),
    ).expect(200);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({ paidMembership: true, status: 'confirmed' });
  });
  it('confirms a paid provider contract even when the checkout creation response was lost', async () => {
    const { client } = await billingUser(app);
    const create = fake.provider.createCheckout.getMockImplementation();
    if (!create) throw new Error('Expected provider fake');
    fake.provider.createCheckout.mockImplementationOnce(async (input) => {
      await create(input);
      throw new Error('Provider response was lost');
    });
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(500);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected provider checkout');
    const provider = paidProvider(session);
    fake.contracts.set(provider.id, provider);
    await deliver(signedEvent(session.customer)).expect(200);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({ paidMembership: true, status: 'confirmed' });
    expect(fake.provider.createCheckout).toHaveBeenCalledTimes(1);
  });
  it('refuses a provider contract for the wrong customer or immutable price', async () => {
    const { client } = await billingUser(app);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(session);
    fake.contracts.set(provider.id, provider);
    provider.customer = 'cus_other';
    await deliver(signedEvent(session.customer)).expect(409);
    provider.customer = session.customer;
    const item = provider.items.data[0];
    if (!item) throw new Error('Expected item');
    item.price.id = 'price_other';
    await deliver(signedEvent(session.customer)).expect(409);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.paidMembership,
    ).toBe(false);
  });
});
