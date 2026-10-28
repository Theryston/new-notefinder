import { createHmac } from 'node:crypto';
import { vi } from 'vitest';
import {
  planCatalogSettings,
  planPrices,
  plans,
} from '../../src/database/schema/plans.js';
import type {
  StripeCheckout,
  StripeSubscription,
} from '../../src/integrations/stripe/stripe-billing.service.js';
import { createAuthClient, signIn } from './auth.js';
import type { TestApp } from './create-test-app.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './factories.js';

export const WEBHOOK_SECRET = 'whsec_checkout_test_secret';
export function billingProvider() {
  const sessions = new Map<string, StripeCheckout>();
  const contracts = new Map<string, StripeSubscription>();
  const provider = {
    createCustomer: vi.fn(async (userId: string) => `cus_${userId}`),
    createCheckout: vi.fn(async (input: { id: string; customer: string }) => {
      const session: StripeCheckout = {
        id: `cs_${input.id}`,
        livemode: false,
        customer: input.customer,
        url: `https://checkout.stripe.com/c/pay/${input.id}`,
        status: 'open',
        subscription: null,
      };
      sessions.set(session.id, session);
      return session;
    }),
    findCheckout: vi.fn(
      async (_customer: string, id: string) => sessions.get(`cs_${id}`) ?? null,
    ),
    getCheckout: vi.fn(async (id: string) => {
      const session = sessions.get(id);
      if (!session) throw new Error('Unknown checkout');
      return session;
    }),
    expireCheckout: vi.fn(async (id: string) => {
      const session = sessions.get(id);
      if (session?.status !== 'open')
        throw new Error('Checkout cannot be expired');
      session.status = 'expired';
      return session;
    }),
    getSubscription: vi.fn(async (id: string) => {
      const contract = contracts.get(id);
      if (!contract) throw new Error('Unknown subscription');
      return contract;
    }),
  };
  return { provider, sessions, contracts };
}
export async function billingUser(app: TestApp, username?: null) {
  const user = await createUser(
    app.db,
    username === null ? { username: null } : {},
  );
  await createCredentialAccount(app.db, user);
  const client = createAuthClient(app);
  await signIn(client, {
    email: user.email,
    password: DEFAULT_PASSWORD,
  }).expect(200);
  return { user, client };
}
export async function billingCatalog(app: TestApp) {
  await app.db.insert(plans).values({
    id: 'pro',
    kind: 'paid',
    published: true,
    saleEnabled: true,
    enabledCycles: ['monthly', 'annual'],
    copy: {
      en: { name: 'Pro', description: 'Support singing.' },
      'pt-BR': { name: 'Pro', description: 'Localized singing support.' },
    },
  });
  await app.db
    .insert(planCatalogSettings)
    .values({ id: 'catalog', contractingEnabled: true });
  await app.db.insert(planPrices).values([
    {
      id: 'brl-monthly',
      planId: 'pro',
      cycle: 'monthly',
      currency: 'BRL',
      amount: 1990,
      stripePriceId: 'price_brl_monthly',
    },
    {
      id: 'brl-annual',
      planId: 'pro',
      cycle: 'annual',
      currency: 'BRL',
      amount: 19900,
      stripePriceId: 'price_brl_annual',
    },
    {
      id: 'usd-monthly',
      planId: 'pro',
      cycle: 'monthly',
      currency: 'USD',
      amount: 350,
      stripePriceId: 'price_usd_monthly',
    },
    {
      id: 'usd-annual',
      planId: 'pro',
      cycle: 'annual',
      currency: 'USD',
      amount: 3500,
      stripePriceId: 'price_usd_annual',
    },
  ]);
}
export const checkoutBody = (locale = 'en', cycle = 'monthly') => ({
  planId: 'pro',
  offerId: `${locale === 'en' ? 'usd' : 'brl'}-${cycle}`,
  cycle,
  locale,
  comingSoonAcknowledged: true,
});
export function signedEvent(
  customer: string,
  id: string = crypto.randomUUID(),
  type = 'checkout.session.completed',
) {
  const body = JSON.stringify({
    id,
    type,
    livemode: false,
    data: { object: { customer } },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return { body, signature: `t=${timestamp},v1=${digest}` };
}
export function paidProvider(
  session: StripeCheckout,
  input: { amount?: number; currency?: string; price?: string } = {},
): StripeSubscription {
  session.status = 'complete';
  session.subscription = `sub_${session.id}`;
  return {
    id: session.subscription,
    customer: session.customer,
    livemode: false,
    status: 'active',
    currency: input.currency ?? 'usd',
    cancel_at_period_end: false,
    latest_invoice: {
      status: 'paid',
      amount_paid: input.amount ?? 350,
    },
    items: {
      data: [
        {
          price: {
            id: input.price ?? 'price_usd_monthly',
            currency: input.currency ?? 'usd',
            unit_amount: input.amount ?? 350,
          },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        },
      ],
    },
  };
}
