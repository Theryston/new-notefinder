import { parseEnv } from '../../config/env.js';
import en from './locales/en.json' with { type: 'json' };
import ptBR from './locales/pt-BR.json' with { type: 'json' };
import { StripeBillingService } from './stripe-billing.service.js';

describe('Hosted Checkout disclosures', () => {
  it.each(['en', 'pt-BR'] as const)(
    'discloses trial terms in %s',
    async (locale) => {
      const network = vi.fn<typeof fetch>().mockImplementation(async () =>
        Response.json({
          id: 'cs_test',
          livemode: false,
          url: 'https://checkout.stripe.com/c/pay/test',
          status: 'open',
          customer: 'cus_test',
          subscription: null,
        }),
      );
      vi.stubGlobal('fetch', network);
      const env = parseEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost/test',
        REDIS_URL: 'redis://localhost',
        STRIPE_SECRET_KEY: 'sk_test_unit',
      });
      try {
        const stripe = new StripeBillingService(env);
        await stripe.createCheckout({
          id: 'trial',
          customer: 'cus_test',
          price: 'price_test',
          locale,
          trialDays: 14,
        });
        const trial = new URLSearchParams(
          String(network.mock.calls[0]?.[1]?.body),
        );
        const disclosure = trial.get('custom_text[submit][message]');
        expect(disclosure).toBe(
          locale === 'en'
            ? en.trialCheckoutDisclosure
            : ptBR.trialCheckoutDisclosure,
        );
        expect(disclosure).not.toBe(
          locale === 'en' ? en.checkoutDisclosure : ptBR.checkoutDisclosure,
        );
        if (locale === 'en') {
          expect(disclosure).toContain('coming soon');
          expect(disclosure).toContain('automatically after the trial');
          expect(disclosure).toContain('cancel');
        }
        await stripe.createCheckout({
          id: 'immediate',
          customer: 'cus_test',
          price: 'price_test',
          locale,
        });
        const immediate = new URLSearchParams(
          String(network.mock.calls[1]?.[1]?.body),
        );
        expect(immediate.get('custom_text[submit][message]')).toBe(
          locale === 'en' ? en.checkoutDisclosure : ptBR.checkoutDisclosure,
        );
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );
});
