import { parseEnv } from '../../config/env.js';
import {
  StripeBillingService,
  type StripeSubscription,
} from '../../integrations/stripe/stripe-billing.service.js';
import { renewalFailure } from './renewal-failure.js';

const env = parseEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/test',
  REDIS_URL: 'redis://localhost',
  STRIPE_SECRET_KEY: 'sk_test_unit',
});
describe('renewal failure reconciliation', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it.each(['invoice.payment_failed', 'customer.subscription.updated'])(
    'recovers the original failure when %s arrives first',
    async (type) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
      const now = Date.now() / 1000;
      const provider: StripeSubscription = {
        id: 'sub_test',
        livemode: false,
        customer: 'cus_test',
        status: 'past_due',
        currency: 'usd',
        cancel_at_period_end: false,
        latest_invoice: {
          id: 'in_test',
          status: 'open',
          billing_reason: 'subscription_cycle',
          amount_paid: 0,
          created: now - 3600,
          due_date: null,
        },
        items: {
          data: [
            {
              price: { id: 'price', unit_amount: 350, currency: 'usd' },
              current_period_start: now - 3600,
              current_period_end: now + 60,
            },
          ],
        },
      };
      const retry = {
        id: 'evt_retry',
        created: now - 60,
        livemode: false,
        data: { object: { id: 'in_test', customer: 'cus_test' } },
      };
      const original = { ...retry, id: 'evt_original', created: now - 120 };
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            Response.json({ data: [retry, original], has_more: false }),
          ),
      );
      expect(
        await renewalFailure({
          stripe: new StripeBillingService(env),
          customer: 'cus_test',
          provider,
          hasPaidInvoice: true,
          recoveryStartedAt: null,
          event: {
            type,
            created: retry.created,
            data: { object: { id: 'in_test' } },
          },
        }),
      ).toEqual({ invoiceId: 'in_test', occurredAt: original.created });
    },
  );
});
