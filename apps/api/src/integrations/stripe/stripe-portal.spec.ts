import type { Env } from '../../config/env.js';
import { StripeBillingService } from './stripe-billing.service.js';

const safe = {
  active: true,
  livemode: false,
  features: {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: { enabled: false },
  },
};
const env = {
  WEB_URL: 'https://vozzify.example',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_123',
} as Env;

afterEach(() => vi.restoreAllMocks());
describe('Stripe Customer Portal', () => {
  it('validates portal policy and creates a session returning to the localized subscription page', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(safe)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            url: 'https://billing.stripe.com/session/test',
            livemode: false,
          }),
        ),
      );
    expect(
      await new StripeBillingService(env).createPortal('cus_owner', 'pt-BR'),
    ).toBe('https://billing.stripe.com/session/test');
    const options = fetcher.mock.calls[1]?.[1];
    const body = new URLSearchParams(String(options?.body));
    expect(body.get('customer')).toBe('cus_owner');
    expect(body.get('configuration')).toBe('bpc_123');
    expect(body.get('return_url')).toBe(
      'https://vozzify.example/pt-BR/subscription',
    );
  });
  it.each([
    {
      ...safe,
      features: {
        ...safe.features,
        subscription_cancel: { enabled: true, mode: 'immediately' },
      },
    },
    {
      ...safe,
      features: { ...safe.features, subscription_update: { enabled: true } },
    },
    { ...safe, livemode: true },
  ])('refuses an unsafe configuration', async (configuration) => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(configuration)));
    await expect(
      new StripeBillingService(env).createPortal('cus_owner', 'en'),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
