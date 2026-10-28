import type { StripeSubscription } from '../../integrations/stripe/stripe-billing.service.js';
import { confirmedSubscription } from './subscription-state.js';

const contract = {
  stripeSubscriptionId: null,
  stripePriceId: 'price_monthly',
  amount: 350,
  currency: 'USD',
};
function provider(): StripeSubscription {
  return {
    id: 'sub_test',
    livemode: false,
    customer: 'cus_test',
    status: 'active',
    currency: 'usd',
    cancel_at_period_end: false,
    latest_invoice: { status: 'paid', amount_paid: 350 },
    items: {
      data: [
        {
          price: { id: 'price_monthly', unit_amount: 350, currency: 'usd' },
          current_period_start: 100,
          current_period_end: Math.floor(Date.now() / 1000) + 100,
        },
      ],
    },
  };
}
describe('Provider-confirmed immediate payment policy', () => {
  it('confirms a Basil invoice without the removed paid field', () => {
    expect(
      confirmedSubscription({
        contract,
        customer: 'cus_test',
        provider: provider(),
      }),
    ).toMatchObject({
      status: 'confirmed',
      paidMembership: true,
      stripeSubscriptionId: 'sub_test',
    });
  });
  it.each([
    'incomplete',
    'incomplete_expired',
    'past_due',
    'unpaid',
    'canceled',
    'trialing',
    'paused',
  ] as const)('does not grant membership for %s', (status) => {
    expect(
      confirmedSubscription({
        contract,
        customer: 'cus_test',
        provider: { ...provider(), status },
      }).paidMembership,
    ).toBe(false);
  });
  it.each([
    null,
    { status: 'open', amount_paid: 0 },
    { status: 'paid', amount_paid: 349 },
  ])(
    'does not confirm an unpaid or insufficient invoice %j',
    (latest_invoice) => {
      expect(
        confirmedSubscription({
          contract,
          customer: 'cus_test',
          provider: { ...provider(), latest_invoice },
        }).paidMembership,
      ).toBe(false);
    },
  );
  it('expires membership at the exact paid-period boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const current = provider();
    const item = current.items.data[0];
    if (!item) throw new Error('Expected item');
    item.current_period_end = Date.now() / 1000;
    expect(
      confirmedSubscription({
        contract,
        customer: 'cus_test',
        provider: current,
      }).paidMembership,
    ).toBe(false);
    vi.useRealTimers();
  });
  it('rejects customer, price, currency, amount and provider-identity mismatches', () => {
    const current = provider();
    expect(() =>
      confirmedSubscription({ contract, customer: 'other', provider: current }),
    ).toThrow();
    expect(() =>
      confirmedSubscription({
        contract: { ...contract, stripePriceId: 'other' },
        customer: 'cus_test',
        provider: current,
      }),
    ).toThrow();
    expect(() =>
      confirmedSubscription({
        contract: { ...contract, currency: 'BRL' },
        customer: 'cus_test',
        provider: current,
      }),
    ).toThrow();
    expect(() =>
      confirmedSubscription({
        contract: { ...contract, amount: 351 },
        customer: 'cus_test',
        provider: current,
      }),
    ).toThrow();
    expect(() =>
      confirmedSubscription({
        contract: { ...contract, stripeSubscriptionId: 'other' },
        customer: 'cus_test',
        provider: current,
      }),
    ).toThrow();
    current.items.data = [];
    expect(() =>
      confirmedSubscription({
        contract,
        customer: 'cus_test',
        provider: current,
      }),
    ).toThrow();
  });
});
