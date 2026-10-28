import { parseEnv } from '../../config/env.js';
import { StripeBillingService } from './stripe-billing.service.js';

const env = (secret = 'sk_test_unit') =>
  parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost/test',
    REDIS_URL: 'redis://localhost',
    STRIPE_SECRET_KEY: secret,
  });
const session = {
  id: 'cs_test',
  livemode: false,
  url: 'https://checkout.stripe.com/c/pay/test',
  status: 'open',
  customer: 'cus_test',
  subscription: null,
};
describe('Stripe billing network boundary', () => {
  const network = vi.fn<typeof fetch>();
  beforeEach(() => {
    network.mockReset();
    vi.stubGlobal('fetch', network);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('binds the server customer and price to trusted localized return destinations', async () => {
    network
      .mockResolvedValueOnce(Response.json({ id: 'cus_test', livemode: false }))
      .mockResolvedValueOnce(Response.json(session));
    const stripe = new StripeBillingService(env());
    expect(await stripe.createCustomer('user_test')).toBe('cus_test');
    await stripe.createCheckout({
      id: 'attempt',
      customer: 'cus_test',
      price: 'price_current',
      locale: 'pt-BR',
    });
    const options = network.mock.calls[1]?.[1];
    const body = new URLSearchParams(String(options?.body));
    expect(body.get('customer')).toBe('cus_test');
    expect(body.get('line_items[0][price]')).toBe('price_current');
    expect(body.get('success_url')).toBe(
      'http://localhost:3000/pt-BR/subscription?result=pending',
    );
    expect(body.get('cancel_url')).toBe(
      'http://localhost:3000/pt-BR/subscription?result=cancelled',
    );
    expect(body.get('mode')).toBe('subscription');
    expect(options?.headers).toMatchObject({
      'Idempotency-Key': 'checkout-attempt',
      'Stripe-Version': '2025-06-30.basil',
    });
  });
  it('retrieves current provider state and accepts Basil invoice objects without paid', async () => {
    network.mockResolvedValueOnce(Response.json(session)).mockResolvedValueOnce(
      Response.json({
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
              price: { id: 'price_current', unit_amount: 350, currency: 'usd' },
              current_period_start: 100,
              current_period_end: 200,
            },
          ],
        },
      }),
    );
    const stripe = new StripeBillingService(env());
    expect(await stripe.getCheckout('cs_test')).toEqual(session);
    expect(
      (await stripe.getSubscription('sub_test')).latest_invoice?.status,
    ).toBe('paid');
    expect(network.mock.calls[1]?.[0]).toBe(
      'https://api.stripe.com/v1/subscriptions/sub_test?expand[]=latest_invoice',
    );
  });
  it('reconciles lost checkout responses through paginated provider session records', async () => {
    network
      .mockResolvedValueOnce(
        Response.json({
          data: [{ ...session, id: 'cs_other', metadata: {} }],
          has_more: true,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [{ ...session, metadata: { contractId: 'attempt' } }],
          has_more: false,
        }),
      );
    expect(
      (
        await new StripeBillingService(env()).findCheckout(
          'cus_test',
          'attempt',
        )
      )?.id,
    ).toBe('cs_test');
    expect(String(network.mock.calls[1]?.[0])).toContain(
      'starting_after=cs_other',
    );
    network.mockResolvedValueOnce(Response.json({ data: [], has_more: false }));
    expect(
      await new StripeBillingService(env()).findCheckout('cus_test', 'absent'),
    ).toBeNull();
  });
  it('rejects missing configuration, provider failures and live-mode objects', async () => {
    await expect(
      new StripeBillingService(env('')).createCustomer('user'),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    network.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    await expect(
      new StripeBillingService(env()).getCheckout('cs_test'),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    network.mockResolvedValueOnce(
      Response.json({ ...session, livemode: true }),
    );
    await expect(
      new StripeBillingService(env()).getCheckout('cs_test'),
    ).rejects.toThrow();
  });
});
