import { eq } from 'drizzle-orm';
import {
  billingCustomers,
  subscriptionHistory,
  subscriptionPriceChanges,
  subscriptions,
} from '../src/database/schema/subscriptions.js';
import { StripeBillingService } from '../src/integrations/stripe/stripe-billing.service.js';
import {
  billingCatalog,
  billingProvider,
  billingUser,
  checkoutBody,
  paidProvider,
} from './utils/billing-fixture.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';

describe('price notice history', () => {
  let app: TestApp;
  const fake = billingProvider();
  beforeAll(async () => {
    app = await createTestApp({
      override: (builder) =>
        builder.overrideProvider(StripeBillingService).useValue(fake.provider),
    });
  });
  afterAll(async () => app.close());
  beforeEach(async () => {
    await resetDatabase(app.db);
    await billingCatalog(app);
    fake.contracts.clear();
    fake.sessions.clear();
  });
  it('keeps the notice record when a canceled subscriber returns', async () => {
    const { user, client } = await billingUser(app);
    const session = {
      id: 'cs_old',
      livemode: false as const,
      customer: 'cus_old',
      status: 'open' as const,
      subscription: null,
      url: 'https://checkout.stripe.com/old',
    };
    const provider = paidProvider(session);
    provider.status = 'canceled';
    const item = provider.items.data[0];
    if (!item) throw new Error('Missing subscription item');
    item.current_period_end = Math.floor(Date.now() / 1000) - 1;
    fake.contracts.set(provider.id, provider);
    await app.db
      .insert(billingCustomers)
      .values({ userId: user.id, stripeCustomerId: 'cus_old' });
    await app.db.insert(subscriptions).values({
      id: 'old_contract',
      userId: user.id,
      planId: 'pro',
      priceId: 'usd-monthly',
      cycle: 'monthly',
      currency: 'USD',
      amount: 350,
      stripePriceId: 'price_usd_monthly',
      stripeSubscriptionId: provider.id,
      checkoutId: 'cs_old',
      status: 'confirmed',
      providerStatus: 'canceled',
      paidMembership: false,
      currentPeriodStart: new Date(item.current_period_start * 1000),
      currentPeriodEnd: new Date(item.current_period_end * 1000),
    });
    await app.db.insert(subscriptionPriceChanges).values({
      id: 'old_notice',
      userId: user.id,
      subscriptionId: 'old_contract',
      oldPriceId: 'usd-monthly',
      newPriceId: 'usd-annual',
      oldAmount: 350,
      newAmount: 3500,
      noticeStatus: 'sent',
      noticeSentAt: new Date(),
      effectiveAt: new Date(),
      scheduleStatus: 'pending',
    });
    await client
      .post('/v1/me/subscription/checkout')
      .send(checkoutBody())
      .expect(201);
    expect(
      await app.db
        .select()
        .from(subscriptionHistory)
        .where(eq(subscriptionHistory.id, 'old_contract')),
    ).toHaveLength(1);
    const records = await app.db
      .select()
      .from(subscriptionPriceChanges)
      .where(eq(subscriptionPriceChanges.id, 'old_notice'));
    expect(records[0]).toMatchObject({
      subscriptionId: 'old_contract',
      oldAmount: 350,
      newAmount: 3500,
      scheduleStatus: 'cancelled',
    });
  });
});
