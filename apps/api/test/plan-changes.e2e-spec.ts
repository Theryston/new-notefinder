import { planPrices, plans } from '../src/database/schema/plans.js';
import { subscriptionChanges } from '../src/database/schema/subscriptions.js';
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
describe('Scheduled subscription changes (e2e)', () => {
  let app: TestApp;
  const fake = billingProvider();
  let remotePrice: string | null = null;
  const schedule = vi.fn(async (input: { nextPrice: string }) => {
    remotePrice = input.nextPrice;
  });
  const inspect = vi.fn(async (input: { nextPrice: string }) =>
    remotePrice === input.nextPrice
      ? ('pending' as const)
      : ('previous' as const),
  );
  const prepare = vi.fn(
    async (_input: {
      schedule: string | null;
      previousPrice?: string | null;
      nextPrice?: string;
    }) => 'sched_test',
  );
  beforeAll(async () => {
    app = await createTestApp({
      env: { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET },
      override: (builder) =>
        builder.overrideProvider(StripeBillingService).useValue({
          ...fake.provider,
          prepareSchedule: prepare,
          inspectSchedule: inspect,
          scheduleChange: schedule,
        }),
    });
  });
  afterAll(async () => app.close());
  beforeEach(async () => {
    await resetDatabase(app.db);
    await billingCatalog(app);
    fake.sessions.clear();
    fake.contracts.clear();
    vi.clearAllMocks();
    remotePrice = null;
  });
  async function subscriber(cycle: 'monthly' | 'annual' = 'monthly') {
    const { client } = await billingUser(app);
    await client
      .post(`${ROOT}/checkout`)
      .send(checkoutBody('en', cycle))
      .expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(
      session,
      cycle === 'annual' ? { price: 'price_usd_annual', amount: 3500 } : {},
    );
    fake.contracts.set(provider.id, provider);
    const deliver = async () => {
      const event = signedEvent(session.customer);
      await app.http
        .post('/v1/billing/stripe-webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', event.signature)
        .send(event.body)
        .expect(200);
    };
    await deliver();
    return { client, provider, deliver };
  }
  it('schedules an annual USD offer at the existing period end and keeps the current membership', async () => {
    const { client, provider } = await subscriber();
    const end = provider.items.data[0]?.current_period_end;
    if (!end) throw new Error('Expected period end');
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(201);
    const result = await client.get(`${ROOT}?locale=en`).expect(200);
    expect(result.body.subscription).toMatchObject({
      planId: 'pro',
      cycle: 'monthly',
      currency: 'USD',
      amount: 350,
      paidMembership: true,
      pendingChange: {
        planId: 'pro',
        planName: 'Pro',
        cycle: 'annual',
        currency: 'USD',
        amount: 3500,
        effectiveAt: new Date(end * 1000).toISOString(),
      },
    });
  });
  it('rejects a destination in another currency and retains the earlier agreed change after a failed revision', async () => {
    const { client } = await subscriber();
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'brl-annual', cycle: 'annual' })
      .expect(409);
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(201);
    schedule.mockRejectedValueOnce(new Error('Stripe unavailable'));
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-monthly', cycle: 'monthly' })
      .expect(500);
    const result = await client.get(ROOT).expect(200);
    expect(result.body.subscription.pendingChange).toMatchObject({
      cycle: 'annual',
      currency: 'USD',
      amount: 3500,
    });
  });
  it('requires authentication before scheduling', async () => {
    await app.http
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(401);
  });
  it('projects confirmed provider activation at period end without creating another subscription', async () => {
    const { client, provider, deliver } = await subscriber();
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(201);
    const item = provider.items.data[0];
    if (!item || !provider.latest_invoice)
      throw new Error('Expected provider item and invoice');
    item.current_period_start = item.current_period_end;
    item.current_period_end += 31536000;
    item.price.id = 'price_usd_annual';
    item.price.unit_amount = 3500;
    provider.latest_invoice.amount_paid = 3500;
    await deliver();
    const result = await client.get(ROOT).expect(200);
    expect(result.body.subscription).toMatchObject({
      cycle: 'annual',
      amount: 3500,
      currency: 'USD',
      paidMembership: true,
      pendingChange: null,
    });
    expect(fake.sessions.size).toBe(1);
  });
  it('revises an annual subscription to another plan and then to monthly only once', async () => {
    await app.db.insert(plans).values({
      id: 'other',
      kind: 'paid',
      published: true,
      saleEnabled: true,
      enabledCycles: ['monthly'],
      copy: {
        en: { name: 'Other', description: 'Other plan' },
        'pt-BR': { name: 'Other', description: 'Other plan' },
      },
    });
    await app.db.insert(planPrices).values([
      {
        id: 'other-usd',
        planId: 'other',
        cycle: 'monthly',
        currency: 'USD',
        amount: 500,
        stripePriceId: 'price_other_usd',
      },
      {
        id: 'other-brl',
        planId: 'other',
        cycle: 'monthly',
        currency: 'BRL',
        amount: 2500,
        stripePriceId: 'price_other_brl',
      },
    ]);
    const { client } = await subscriber('annual');
    const other = { planId: 'other', offerId: 'other-usd', cycle: 'monthly' };
    await client.post(`${ROOT}/change`).send(other).expect(201);
    await client.post(`${ROOT}/change`).send(other).expect(201);
    expect(schedule).toHaveBeenCalledTimes(1);
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-monthly', cycle: 'monthly' })
      .expect(201);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({
      cycle: 'annual',
      amount: 3500,
      pendingChange: { planId: 'pro', cycle: 'monthly', amount: 350 },
    });
    expect(schedule).toHaveBeenCalledTimes(2);
  });
  it('clears a pending change when cancellation is confirmed', async () => {
    const { client, provider, deliver } = await subscriber();
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(201);
    provider.cancel_at_period_end = true;
    await deliver();
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({ cancelAtPeriodEnd: true, pendingChange: null });
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(409);
  });
  it('persists the provider schedule before update and resumes after a lost response beyond the idempotency window', async () => {
    const { client } = await subscriber();
    const destination = {
      planId: 'pro',
      offerId: 'usd-annual',
      cycle: 'annual',
    };
    schedule.mockRejectedValueOnce(new Error('Lost provider response'));
    await client.post(`${ROOT}/change`).send(destination).expect(500);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 25 * 60 * 60 * 1000);
    try {
      await client.post(`${ROOT}/change`).send(destination).expect(201);
      expect(prepare.mock.calls[1]?.[0]).toMatchObject({
        schedule: 'sched_test',
      });
      expect(
        (await client.get(ROOT).expect(200)).body.subscription.pendingChange,
      ).toMatchObject({ cycle: 'annual', amount: 3500 });
    } finally {
      vi.restoreAllMocks();
    }
  });
  it('reconciles a successful provider update whose response was lost before another revision', async () => {
    const { client } = await subscriber();
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(201);
    schedule.mockImplementationOnce(async (input) => {
      remotePrice = input.nextPrice;
      throw new Error('Response lost after provider update');
    });
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-monthly', cycle: 'monthly' })
      .expect(500);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.pendingChange,
    ).toBeNull();
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(201);
    expect(prepare.mock.calls.at(-1)?.[0]).toMatchObject({
      previousPrice: null,
      nextPrice: 'price_usd_annual',
    });
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.pendingChange,
    ).toMatchObject({ cycle: 'annual', amount: 3500 });
  });
  it('removes the scheduled change when the current offer is selected again', async () => {
    const { client } = await subscriber();
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(201);
    const result = await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-monthly', cycle: 'monthly' })
      .expect(201);
    expect(result.body.subscription).toMatchObject({
      cycle: 'monthly',
      amount: 350,
      paidMembership: true,
      pendingChange: null,
    });
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.pendingChange,
    ).toBeNull();
    expect(schedule).toHaveBeenCalledTimes(2);
  });
  it('cleans up an already applied schedule that repeats the active offer', async () => {
    const { client } = await subscriber();
    await client
      .post(`${ROOT}/change`)
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(201);
    await app.db.update(subscriptionChanges).set({
      priceId: 'usd-monthly',
      stripePriceId: 'price_usd_monthly',
      cycle: 'monthly',
      amount: 350,
    });
    const result = await client.get(ROOT).expect(200);
    expect(result.body.subscription).toMatchObject({
      cycle: 'monthly',
      pendingChange: null,
    });
    expect(schedule).toHaveBeenCalledTimes(2);
  });
});
