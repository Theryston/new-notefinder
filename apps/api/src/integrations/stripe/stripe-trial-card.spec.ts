import { parseEnv } from '../../config/env.js';
import { StripeBillingService } from './stripe-billing.service.js';

describe('Stripe trial card confirmation', () => {
  it('accepts a customer invoice-default card when the subscription has no own default', async () => {
    const network = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', network);
    network
      .mockResolvedValueOnce(
        Response.json({
          id: 'sub_test',
          livemode: false,
          customer: 'cus_test',
          status: 'trialing',
          currency: 'usd',
          cancel_at_period_end: false,
          trial_start: 100,
          trial_end: 86500,
          default_payment_method: null,
          latest_invoice: null,
          items: {
            data: [
              {
                price: {
                  id: 'price_current',
                  unit_amount: 350,
                  currency: 'usd',
                },
                current_period_start: 100,
                current_period_end: 86500,
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 'cus_test',
          livemode: false,
          invoice_settings: { default_payment_method: 'pm_card' },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 'pm_card',
          customer: 'cus_test',
          livemode: false,
          type: 'card',
        }),
      );
    const env = parseEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost/test',
      REDIS_URL: 'redis://localhost',
      STRIPE_SECRET_KEY: 'sk_test_unit',
    });
    const stripe = new StripeBillingService(env);
    try {
      expect(
        (await stripe.getSubscription('sub_test')).default_payment_method,
      ).toBe('pm_card');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
