import { confirmedSubscription } from './subscription-state.js';

describe('Provider-confirmed card-backed trial', () => {
  it('grants membership until the agreed trial ends without requiring a paid invoice', () => {
    const end = Math.floor(Date.now() / 1000) + 86_400;
    const result = confirmedSubscription({
      contract: {
        stripeSubscriptionId: null,
        stripePriceId: 'price_trial',
        amount: 350,
        currency: 'USD',
        trialDays: 1,
      },
      customer: 'cus_trial',
      provider: {
        id: 'sub_trial',
        livemode: false,
        customer: 'cus_trial',
        status: 'trialing',
        currency: 'usd',
        cancel_at_period_end: false,
        default_payment_method: 'pm_card',
        trial_end: end,
        trial_start: end - 86400,
        latest_invoice: null,
        items: {
          data: [
            {
              price: { id: 'price_trial', unit_amount: 350, currency: 'usd' },
              current_period_start: end - 86_400,
              current_period_end: end,
            },
          ],
        },
      },
    });
    expect(result).toMatchObject({ status: 'confirmed', paidMembership: true });
  });
});
