import { eq } from 'drizzle-orm';
import {
  billingCustomers,
  subscriptionChanges,
  subscriptionPriceChanges,
  subscriptions,
} from '../src/database/schema/subscriptions.js';
import type { EmailMessage } from '../src/integrations/email/email.job.js';
import {
  type EmailSendOptions,
  EmailService,
} from '../src/integrations/email/email.service.js';
import { PriceNoticeReconciliation } from '../src/integrations/email/price-notice-reconciliation.js';
import { StripeBillingService } from '../src/integrations/stripe/stripe-billing.service.js';
import { StripeCatalogService } from '../src/integrations/stripe/stripe-catalog.service.js';
import type { ScheduleInput } from '../src/integrations/stripe/stripe-schedule.js';
import { PriceChangeReconcileService } from '../src/modules/plans/price-change-reconcile.service.js';
import { PriceChangesService } from '../src/modules/plans/price-changes.service.js';
import { createAuthClient, signIn } from './utils/auth.js';
import {
  billingCatalog,
  billingUser,
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
import {
  priceChangeBody as body,
  nearRenewal,
} from './utils/price-change-body.js';
import { checkRejectedRetry } from './utils/price-change-rejected.js';

describe('notice dispatch and scheduling (e2e)', () => {
  let app: TestApp;
  let delivery:
    | { state: 'missing' | 'failed' | 'rejected' }
    | { state: 'sent'; sentAt: Date } = { state: 'missing' };
  let end = 0;
  let currentPrice = 'price_usd_monthly';
  let currentAmount = 350;
  let providerStatus: 'active' | 'past_due' | 'trialing' = 'active';
  const email = {
    send: vi.fn(
      async (_message: EmailMessage, _options: EmailSendOptions) => undefined,
    ),
    delivery: vi.fn(async () => delivery),
    retryDelivery: vi.fn(async () => undefined),
  };
  const reconciliation = {
    find: vi.fn(async () => ({ found: true, cursor: null })),
  };
  const billing = {
    getSubscription: vi.fn(async () => ({
      id: 'sub_test',
      livemode: false,
      customer: 'cus_test',
      status: providerStatus,
      currency: 'usd',
      cancel_at_period_end: false,
      billing_cycle_anchor: end,
      trial_end: providerStatus === 'trialing' ? end : null,
      schedule: null,
      latest_invoice: { status: 'paid', amount_paid: currentAmount },
      items: {
        data: [
          {
            price: {
              id: currentPrice,
              currency: 'usd',
              unit_amount: currentAmount,
            },
            current_period_start: end - 30 * 86400,
            current_period_end: end,
          },
        ],
      },
    })),
    prepareSchedule: vi.fn(async () => 'sched_test'),
    scheduleChange: vi.fn(async (_input: ScheduleInput) => undefined),
    getCheckout: vi.fn(async () => ({
      id: 'cs_test',
      livemode: false,
      status: 'complete',
      customer: 'cus_test',
      subscription: 'sub_test',
      url: null,
    })),
    inspectSchedule: vi.fn(async () => 'previous'),
  };
  const catalog = {
    syncProduct: vi.fn(async () => 'prod_pro'),
    ensurePrice: vi.fn(async (input: { key: string }) => `price_${input.key}`),
  };
  beforeAll(async () => {
    app = await createTestApp({
      env: { RESEND_API_KEY: 're_test', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET },
      override: (builder) =>
        builder
          .overrideProvider(StripeCatalogService)
          .useValue(catalog)
          .overrideProvider(StripeBillingService)
          .useValue(billing)
          .overrideProvider(EmailService)
          .useValue(email)
          .overrideProvider(PriceNoticeReconciliation)
          .useValue(reconciliation),
    });
  });
  afterAll(async () => app.close());
  beforeEach(async () => {
    await resetDatabase(app.db);
    await billingCatalog(app);
    vi.clearAllMocks();
    delivery = { state: 'missing' };
    end = Math.floor(Date.now() / 1000) + 45 * 86400;
    currentPrice = 'price_usd_monthly';
    currentAmount = 350;
    providerStatus = 'active';
  });
  async function setup(
    cycle: 'monthly' | 'annual' = 'monthly',
    pending = false,
  ) {
    const subscriber = await billingUser(app);
    currentPrice = `price_usd_${cycle}`;
    currentAmount = cycle === 'monthly' ? 350 : 3500;
    await app.db.insert(subscriptions).values({
      userId: subscriber.user.id,
      planId: 'pro',
      priceId: `usd-${cycle}`,
      cycle,
      currency: 'USD',
      amount: currentAmount,
      stripePriceId: currentPrice,
      stripeSubscriptionId: pending ? null : 'sub_test',
      checkoutId: 'cs_test',
      status: pending ? 'pending' : 'confirmed',
      providerStatus: pending ? null : 'active',
      paidMembership: !pending,
      currentPeriodStart: new Date((end - 30 * 86400) * 1000),
      currentPeriodEnd: new Date(end * 1000),
    });
    await app.db
      .insert(billingCustomers)
      .values({ userId: subscriber.user.id, stripeCustomerId: 'cus_test' });
    const user = await createUser(app.db, { role: 'ADMIN' });
    await createCredentialAccount(app.db, user);
    const admin = createAuthClient(app);
    await signIn(admin, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    const input = body();
    if (cycle === 'annual')
      input.prices[3] = { cycle: 'annual', currency: 'USD', amount: 5000 };
    await admin.put('/v1/admin/plans/pro').send(input).expect(200);
    return { subscriber, admin };
  }
  it('waits for dispatch before scheduling or disclosing the new price and replays without duplication', async () => {
    const { subscriber } = await setup();
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(billing.scheduleChange).not.toHaveBeenCalled();
    expect(
      (await subscriber.client.get('/v1/me/subscription').expect(200)).body
        .subscription.pendingPriceChange ?? null,
    ).toBeNull();
    delivery = { state: 'sent', sentAt: new Date() };
    await worker.processPending();
    expect(billing.scheduleChange).toHaveBeenCalledTimes(1);
    expect(
      (await subscriber.client.get('/v1/me/subscription').expect(200)).body
        .subscription.pendingPriceChange,
    ).toMatchObject({
      amount: 500,
      currency: 'USD',
      effectiveAt: new Date(end * 1000).toISOString(),
      status: 'scheduled',
    });
    await worker.processPending();
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(billing.scheduleChange).toHaveBeenCalledTimes(1);
  });
  it('reports failed dispatch to admins without scheduling a price change', async () => {
    const { subscriber, admin } = await setup();
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    delivery = { state: 'failed' };
    await worker.processPending();
    expect(billing.scheduleChange).not.toHaveBeenCalled();
    expect(
      (await subscriber.client.get('/v1/me/subscription').expect(200)).body
        .subscription.pendingPriceChange ?? null,
    ).toBeNull();
    expect(
      (await admin.get('/v1/admin/plans').expect(200)).body.plans[0]
        .priceMigrations.failed,
    ).toBe(1);
    await admin.post('/v1/admin/plans/pro/price-changes/retry').expect(201);
    expect(email.retryDelivery).toHaveBeenCalledTimes(1);
    delivery = { state: 'sent', sentAt: new Date() };
    await worker.processPending();
    expect(
      (await subscriber.client.get('/v1/me/subscription').expect(200)).body
        .subscription.pendingPriceChange.amount,
    ).toBe(500);
    expect(billing.scheduleChange).toHaveBeenCalledTimes(1);
  });

  it('shows provider scheduling failure and retries the same announced transition', async () => {
    const { subscriber, admin } = await setup();
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    delivery = { state: 'sent', sentAt: new Date() };
    billing.scheduleChange.mockRejectedValueOnce(
      new Error('Provider unavailable'),
    );
    await worker.processPending();
    expect(
      (await admin.get('/v1/admin/plans').expect(200)).body.plans[0]
        .priceMigrations.failed,
    ).toBe(1);
    expect(
      (await subscriber.client.get('/v1/me/subscription').expect(200)).body
        .subscription.pendingPriceChange.status,
    ).toBe('failed');
    await admin.post('/v1/admin/plans/pro/price-changes/retry').expect(201);
    await worker.processPending();
    expect(
      (await subscriber.client.get('/v1/me/subscription').expect(200)).body
        .subscription.pendingPriceChange.status,
    ).toBe('scheduled');
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('allows a renewal at exactly 30 days after dispatch', async () => {
    const now = Math.floor(Date.now() / 1000) * 1000;
    end = now / 1000 + 30 * 86400;
    const { subscriber } = await setup();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    try {
      const worker = app.app.get(PriceChangesService);
      await worker.processPending();
      delivery = { state: 'sent', sentAt: new Date(now) };
      await worker.processPending();
      const response = await subscriber.client
        .get('/v1/me/subscription')
        .expect(200);
      expect(response.body.subscription.pendingPriceChange).toMatchObject({
        effectiveAt: new Date(end * 1000).toISOString(),
        status: 'scheduled',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends a corrected notice instead of scheduling when dispatch misses the boundary', async () => {
    const now = Math.floor(Date.now() / 1000) * 1000;
    end = now / 1000 + 30 * 86400;
    await setup();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    try {
      const worker = app.app.get(PriceChangesService);
      await worker.processPending();
      delivery = { state: 'sent', sentAt: new Date(now + 1000) };
      vi.setSystemTime(now + 1000);
      await worker.processPending();
      expect(billing.scheduleChange).not.toHaveBeenCalled();
      delivery = { state: 'missing' };
      await worker.processPending();
      expect(email.send).toHaveBeenCalledTimes(2);
      const first = email.send.mock.calls[0]?.[0];
      const second = email.send.mock.calls[1]?.[0];
      expect(first?.text).not.toEqual(second?.text);
    } finally {
      vi.useRealTimers();
    }
  });

  it('defers an imminent monthly renewal and does not schedule before that renewal', async () => {
    end = nearRenewal();
    const { subscriber } = await setup();
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    delivery = { state: 'sent', sentAt: new Date() };
    await worker.processPending();
    const response = await subscriber.client
      .get('/v1/me/subscription')
      .expect(200);
    const expected = new Date(end * 1000);
    expected.setUTCMonth(expected.getUTCMonth() + 1);
    expect(response.body.subscription.pendingPriceChange).toMatchObject({
      effectiveAt: expected.toISOString(),
      status: 'pending',
    });
    expect(billing.scheduleChange).not.toHaveBeenCalled();
  });

  it('defers an imminent annual renewal by a year', async () => {
    end = nearRenewal();
    const { subscriber } = await setup('annual');
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    delivery = { state: 'sent', sentAt: new Date() };
    await worker.processPending();
    const response = await subscriber.client
      .get('/v1/me/subscription')
      .expect(200);
    const expected = new Date(end * 1000);
    expected.setUTCFullYear(expected.getUTCFullYear() + 1);
    expect(response.body.subscription.pendingPriceChange).toMatchObject({
      amount: 5000,
      effectiveAt: expected.toISOString(),
      status: 'pending',
    });
    expect(billing.scheduleChange).not.toHaveBeenCalled();
  });

  it('waits during payment recovery and while a user plan change is pending', async () => {
    providerStatus = 'past_due';
    const { subscriber } = await setup();
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    expect(email.send).not.toHaveBeenCalled();
    const [contract] = await app.db.select().from(subscriptions);
    if (!contract) throw new Error('Expected subscription');
    await app.db.insert(subscriptionChanges).values({
      id: 'user-change',
      subscriptionId: contract.id,
      userId: subscriber.user.id,
      planId: 'pro',
      priceId: 'usd-annual',
      cycle: 'annual',
      currency: 'USD',
      amount: 3500,
      stripePriceId: 'price_usd_annual',
      effectiveAt: new Date(end * 1000),
      applied: true,
    });
    providerStatus = 'active';
    await worker.processPending();
    expect(email.send).not.toHaveBeenCalled();
    expect(billing.scheduleChange).not.toHaveBeenCalled();
  });

  it('schedules a qualifying trial conversion without ending the trial early', async () => {
    providerStatus = 'trialing';
    const { subscriber } = await setup();
    await app.db
      .update(subscriptions)
      .set({ providerStatus: 'trialing', trialDays: 60 })
      .where(eq(subscriptions.userId, subscriber.user.id));
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    delivery = { state: 'sent', sentAt: new Date() };
    await worker.processPending();
    const response = await subscriber.client
      .get('/v1/me/subscription')
      .expect(200);
    expect(response.body.subscription).toMatchObject({
      providerStatus: 'trialing',
      amount: 350,
      pendingPriceChange: {
        amount: 500,
        status: 'scheduled',
        effectiveAt: new Date(end * 1000).toISOString(),
      },
    });
    expect(billing.scheduleChange).toHaveBeenCalledTimes(1);
  });

  it('does not schedule when cancellation follows the queued notice', async () => {
    const { subscriber } = await setup();
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    await app.db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true })
      .where(eq(subscriptions.userId, subscriber.user.id));
    delivery = { state: 'sent', sentAt: new Date() };
    await worker.processPending();
    expect(billing.scheduleChange).not.toHaveBeenCalled();
    expect(
      (await subscriber.client.get('/v1/me/subscription').expect(200)).body
        .subscription.pendingPriceChange ?? null,
    ).toBeNull();
    await app.db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: false })
      .where(eq(subscriptions.userId, subscriber.user.id));
    await worker.processPending();
    expect(billing.scheduleChange).toHaveBeenCalledTimes(1);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('replaces an announced repricing when the subscriber schedules a different cycle', async () => {
    const { subscriber } = await setup();
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    delivery = { state: 'sent', sentAt: new Date() };
    await worker.processPending();
    await subscriber.client
      .post('/v1/me/subscription/change')
      .send({ planId: 'pro', offerId: 'usd-annual', cycle: 'annual' })
      .expect(201);
    const response = await subscriber.client
      .get('/v1/me/subscription')
      .expect(200);
    expect(response.body.subscription.pendingPriceChange ?? null).toBeNull();
    expect(response.body.subscription.pendingChange).toMatchObject({
      cycle: 'annual',
      amount: 3500,
    });
    expect(billing.scheduleChange).toHaveBeenCalledTimes(2);
  });

  it('projects the activated provider price once when a renewal webhook is replayed', async () => {
    const { subscriber } = await setup();
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    delivery = { state: 'sent', sentAt: new Date() };
    await worker.processPending();
    const scheduled = billing.scheduleChange.mock.calls[0]?.[0];
    if (!scheduled) throw new Error('Expected scheduled change');
    currentPrice = scheduled.nextPrice;
    currentAmount = 500;
    end += 30 * 86400;
    const event = signedEvent(
      'cus_test',
      'evt_price_activated',
      'invoice.paid',
    );
    const deliver = () =>
      app.http
        .post('/v1/billing/stripe-webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', event.signature)
        .send(event.body)
        .expect(200);
    await deliver();
    const reads = billing.getSubscription.mock.calls.length;
    await deliver();
    expect(billing.getSubscription).toHaveBeenCalledTimes(reads);
    await worker.processPending();
    const response = await subscriber.client
      .get('/v1/me/subscription')
      .expect(200);
    expect(response.body.subscription.amount).toBe(500);
    expect(response.body.subscription.pendingPriceChange ?? null).toBeNull();
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('notices a checkout confirmed at its old price after the admin edit', async () => {
    const { admin } = await setup('monthly', true);
    const event = signedEvent(
      'cus_test',
      'evt_checkout_after_edit',
      'checkout.session.completed',
    );
    await app.http
      .post('/v1/billing/stripe-webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', event.signature)
      .send(event.body)
      .expect(200);
    const catalog = await admin.get('/v1/admin/plans').expect(200);
    expect(catalog.body.plans[0].priceMigrations).toMatchObject({ pending: 1 });
    await app.app.get(PriceChangesService).processPending();
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('allows a proven rejected notice to be retried after a day', async () => {
    const { admin } = await setup();
    await checkRejectedRetry({
      app,
      admin,
      email,
      setDelivery: (value) => {
        delivery = value;
      },
    });
  });

  it('recovers an ambiguous dispatch only after confirming the provider record', async () => {
    const { subscriber } = await setup();
    const worker = app.app.get(PriceChangesService);
    await worker.processPending();
    await app.db
      .update(subscriptionPriceChanges)
      .set({ noticeStatus: 'uncertain' });
    await app.app.get(PriceChangeReconcileService).processPending();
    await worker.processPending();
    const summary = await subscriber.client
      .get('/v1/me/subscription')
      .expect(200);
    expect(summary.body.subscription.pendingPriceChange).toMatchObject({
      amount: 500,
      status: 'scheduled',
    });
    expect(reconciliation.find).toHaveBeenCalledTimes(1);
    expect(email.send).toHaveBeenCalledTimes(1);
  });
});
