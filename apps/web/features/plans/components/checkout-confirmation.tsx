'use client';
import type { CreateCheckoutBody, Plan } from '@notefinder/contracts';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/i18n/navigation';

type Props = {
  plan: Plan;
  offer: Plan['offers'][number];
  currency: 'BRL' | 'USD';
};
export function CheckoutConfirmation({ plan, offer, currency }: Props) {
  const t = useTranslations('billing');
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function checkout() {
    setPending(true);
    setError(false);
    const body: CreateCheckoutBody = {
      planId: plan.id,
      offerId: offer.id,
      cycle: offer.cycle,
      locale,
      comingSoonAcknowledged: true,
    };
    try {
      const [{ browserApi }, { checkoutResultSchema }] = await Promise.all([
        import('@/lib/api/browser'),
        import('@notefinder/contracts'),
      ]);
      const result = await browserApi('/me/subscription/checkout', {
        schema: checkoutResultSchema,
        method: 'POST',
        body,
      });
      if (result.action === 'manage') router.push('/subscription');
      else window.location.assign(result.url);
    } catch {
      setError(true);
      setPending(false);
    }
  }
  return (
    <section className="max-w-xl space-y-6 rounded-2xl bg-card p-6 shadow-sm">
      <h1 className="font-bold text-3xl tracking-tight">
        {t('checkoutTitle', { plan: plan.name })}
      </h1>
      <p>
        {t(offer.cycle === 'annual' ? 'annualCharge' : 'monthlyCharge', {
          amount: format.number(offer.amount / 100, {
            style: 'currency',
            currency,
          }),
        })}
      </p>
      <p>{t('immediateBilling')}</p>
      <ul className="space-y-2">
        {plan.benefits.map((benefit) => (
          <li key={benefit.id}>
            {benefit.name} ·{' '}
            {t(benefit.status === 'available' ? 'available' : 'comingSoon')}
          </li>
        ))}
      </ul>
      <label className="flex min-h-10 items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-1 size-4"
        />
        {t('acknowledge')}
      </label>
      {error ? <p role="alert">{t('checkoutError')}</p> : null}
      <Button
        disabled={!acknowledged || pending}
        onClick={() => {
          void checkout();
        }}
      >
        {t(pending ? 'redirecting' : 'pay')}
      </Button>
    </section>
  );
}
