import { connection } from 'next/server';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { BillingGate } from '@/features/plans/components/billing-gate';
import { CheckoutOffer } from '@/features/plans/components/checkout-offer';

export const instant = false;
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const { billing } = await getMessages();
  const query = new URLSearchParams();
  for (const key of ['plan', 'cycle', 'offer'])
    if (typeof params[key] === 'string') query.set(key, params[key]);
  return (
    <NextIntlClientProvider messages={{ billing }}>
      <BillingGate redirectTo={`/subscribe?${query}`}>
        <CheckoutOffer
          planId={query.get('plan') ?? ''}
          offerId={query.get('offer') ?? ''}
          cycle={query.get('cycle') ?? ''}
        />
      </BillingGate>
    </NextIntlClientProvider>
  );
}
