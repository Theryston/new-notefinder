import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { subscriptions } from '../src/database/schema/subscriptions.js';
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
describe('failed renewal recovery (e2e)', () => {
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
    fake.sessions.clear();
    fake.contracts.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const deliver = (event: ReturnType<typeof signedEvent>) =>
    app.http
      .post('/v1/billing/stripe-webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', event.signature)
      .send(event.body)
      .expect(200);
  async function confirmedContract() {
    const { client, user } = await billingUser(app);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(session);
    fake.contracts.set(provider.id, provider);
    await deliver(signedEvent(session.customer));
    return { client, user, session, provider };
  }
  it('retains access until the original renewal deadline and restores it after confirmed payment', async () => {
    const { client, session, provider } = await confirmedContract();
    const start = Math.floor(Date.now() / 1000);
    provider.status = 'past_due';
    provider.latest_invoice = {
      id: 'in_renewal',
      status: 'open',
      amount_paid: 0,
      created: start,
      due_date: null,
      billing_reason: 'subscription_cycle',
    };
    await deliver(
      signedEvent(session.customer, 'evt_failure', 'invoice.payment_failed'),
    );
    const deadline = (start + 3 * 86400) * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(deadline - 1);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({
      paidMembership: true,
      recoveryDeadline: new Date(deadline).toISOString(),
    });
    await deliver(
      signedEvent(session.customer, 'evt_retry', 'invoice.payment_failed'),
    );
    vi.spyOn(Date, 'now').mockReturnValue(deadline);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.paidMembership,
    ).toBe(false);
    vi.spyOn(Date, 'now').mockReturnValue(deadline + 1);
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.paidMembership,
    ).toBe(false);
    provider.status = 'active';
    provider.latest_invoice = {
      id: 'in_renewal',
      status: 'paid',
      amount_paid: 350,
    };
    await deliver(signedEvent(session.customer, 'evt_paid', 'invoice.paid'));
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({ paidMembership: true, recoveryDeadline: null });
    await deliver(
      signedEvent(
        session.customer,
        'evt_old_failure',
        'invoice.payment_failed',
      ),
    );
    expect(
      (await client.get(ROOT).expect(200)).body.subscription.paidMembership,
    ).toBe(true);
  });
  it('does not give unpaid trial conversion or initial checkout a renewal grace period', async () => {
    const { client } = await billingUser(app);
    await client.post(`${ROOT}/checkout`).send(checkoutBody()).expect(201);
    const session = [...fake.sessions.values()][0];
    if (!session) throw new Error('Expected checkout');
    const provider = paidProvider(session);
    provider.status = 'past_due';
    provider.latest_invoice = {
      id: 'in_initial',
      status: 'open',
      amount_paid: 0,
      created: Math.floor(Date.now() / 1000),
      due_date: null,
      billing_reason: 'subscription_cycle',
    };
    fake.contracts.set(provider.id, provider);
    await deliver(
      signedEvent(session.customer, 'evt_initial', 'invoice.payment_failed'),
    );
    expect(
      (await client.get(ROOT).expect(200)).body.subscription,
    ).toMatchObject({
      paidMembership: false,
      recoveryDeadline: null,
    });
  });
  it('backfills previously paid contracts without treating a trial as paid', async () => {
    const { user } = await confirmedContract();
    const migration = readFileSync(
      new URL('../drizzle/0037_hot_cobalt_man.sql', import.meta.url),
      'utf8',
    );
    const backfill = migration
      .split('--> statement-breakpoint')
      .find((statement) => statement.includes('UPDATE "subscriptions"'));
    if (!backfill) throw new Error('Expected paid-invoice backfill');
    for (const [providerStatus, expected] of [
      ['trialing', false],
      ['active', true],
    ] as const) {
      await app.db
        .update(subscriptions)
        .set({ hasPaidInvoice: false, providerStatus })
        .where(eq(subscriptions.userId, user.id));
      await app.db.execute(sql.raw(backfill));
      const [row] = await app.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id));
      expect(row?.hasPaidInvoice).toBe(expected);
    }
  });
});
