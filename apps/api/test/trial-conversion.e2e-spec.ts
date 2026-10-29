import { eq } from 'drizzle-orm';
import { plans } from '../src/database/schema/plans.js';
import {
  StripeBillingService,
  type StripeSubscription,
} from '../src/integrations/stripe/stripe-billing.service.js';
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

describe('First payment after a trial (HTTP)', () => {
  let app: TestApp;
  const fake = billingProvider();
  beforeAll(async () => {
    const override = (
      builder: import('@nestjs/testing').TestingModuleBuilder,
    ) => builder.overrideProvider(StripeBillingService).useValue(fake.provider);
    app = await createTestApp({
      override,
      env: { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET },
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
    fake.sessions.clear();
    fake.contracts.clear();
  });
  it.each([
    {
      label: 'paid',
      providerStatus: 'active',
      invoiceStatus: 'paid',
      amountPaid: 350,
      status: 'confirmed',
      membership: true,
    },
    {
      label: 'unpaid',
      providerStatus: 'past_due',
      invoiceStatus: 'open',
      amountPaid: 0,
      status: 'unsuccessful',
      membership: false,
    },
  ] as const)(
    'projects the $label first conversion without losing trial usage',
    async ({
      providerStatus,
      invoiceStatus,
      amountPaid,
      status,
      membership,
    }) => {
      const { client } = await billingUser(app);
      await client
        .post('/v1/me/subscription/checkout')
        .send({ ...checkoutBody(), trialDays: 14 })
        .expect(201);
      const session = [...fake.sessions.values()][0];
      if (!session) throw new Error('Expected checkout');
      const end = Math.floor(Date.now() / 1000) + 86400;
      const provider: StripeSubscription = Object.assign(
        paidProvider(session),
        {
          status: 'trialing' as const,
          latest_invoice: null,
          default_payment_method: 'pm_card',
          trial_end: end,
          trial_start: end - 14 * 86400,
        },
      );
      const item = provider.items.data[0];
      if (!item) throw new Error('Expected subscription item');
      item.current_period_end = end;
      fake.contracts.set(provider.id, provider);
      await sendEvent(app, session.customer);
      expect(
        (await client.get('/v1/me/subscription').expect(200)).body.subscription
          .paidMembership,
      ).toBe(true);
      provider.status = providerStatus;
      provider.latest_invoice = {
        status: invoiceStatus,
        amount_paid: amountPaid,
      };
      item.current_period_start = Math.floor(Date.now() / 1000);
      item.current_period_end = item.current_period_start + 30 * 86400;
      await sendEvent(app, session.customer);
      expect(
        (await client.get('/v1/me/subscription').expect(200)).body.subscription,
      ).toMatchObject({ status, providerStatus, paidMembership: membership });
      expect(
        (await client.get('/v1/me/subscription/trial-eligibility').expect(200))
          .body,
      ).toEqual({ eligible: false });
    },
  );
});

async function sendEvent(app: TestApp, customer: string) {
  const event = signedEvent(customer);
  await app.http
    .post('/v1/billing/stripe-webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', event.signature)
    .send(event.body)
    .expect(200);
}
