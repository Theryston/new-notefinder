import { subscriptions } from '../src/database/schema/subscriptions.js';
import { StripeCatalogService } from '../src/integrations/stripe/stripe-catalog.service.js';
import { createAuthClient, signIn } from './utils/auth.js';
import { billingCatalog, billingUser } from './utils/billing-fixture.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';

describe('successive price edits', () => {
  let app: TestApp;
  const stripe = {
    syncProduct: vi.fn(async () => 'prod_pro'),
    ensurePrice: vi.fn(async (input: { key: string }) => `price_${input.key}`),
  };
  beforeAll(async () => {
    app = await createTestApp({
      override: (builder) =>
        builder.overrideProvider(StripeCatalogService).useValue(stripe),
    });
  });
  afterAll(async () => app.close());
  beforeEach(async () => {
    await resetDatabase(app.db);
    await billingCatalog(app);
  });
  it('retains a later reversal while an earlier price change is still pending', async () => {
    const subscriber = await billingUser(app);
    await app.db.insert(subscriptions).values({
      userId: subscriber.user.id,
      planId: 'pro',
      priceId: 'usd-monthly',
      cycle: 'monthly',
      currency: 'USD',
      amount: 350,
      stripePriceId: 'price_usd_monthly',
      stripeSubscriptionId: 'sub',
      status: 'confirmed',
      providerStatus: 'active',
      paidMembership: true,
    });
    const user = await createUser(app.db, { role: 'ADMIN' });
    await createCredentialAccount(app.db, user);
    const admin = createAuthClient(app);
    await signIn(admin, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    const body = {
      operationId: crypto.randomUUID(),
      copy: {
        en: { name: 'Pro', description: 'Support singing.' },
        'pt-BR': { name: 'Pro', description: 'Localized support.' },
      },
      displayOrder: 0,
      published: true,
      saleEnabled: true,
      enabledCycles: ['monthly', 'annual'],
      prices: [
        { cycle: 'monthly', currency: 'BRL', amount: 1990 },
        { cycle: 'monthly', currency: 'USD', amount: 500 },
        { cycle: 'annual', currency: 'BRL', amount: 19900 },
        { cycle: 'annual', currency: 'USD', amount: 3500 },
      ],
    };
    await admin.put('/v1/admin/plans/pro').send(body).expect(200);
    body.operationId = crypto.randomUUID();
    body.prices[1] = { cycle: 'monthly', currency: 'USD', amount: 350 };
    const response = await admin
      .put('/v1/admin/plans/pro')
      .send(body)
      .expect(200);
    expect(response.body.priceMigrations).toMatchObject({
      pending: 2,
      failed: 0,
    });
  });
});
