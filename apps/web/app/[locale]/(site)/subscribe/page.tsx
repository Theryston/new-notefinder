import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { BillingGate } from '@/features/plans/components/billing-gate';
import { BillingSkeleton } from '@/features/plans/components/billing-skeleton';
import { CheckoutOffer } from '@/features/plans/components/checkout-offer';
import { localeAlternates } from '@/lib/i18n/metadata';

async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('billing');
  return {
    title: t('checkoutHeading'),
    alternates: localeAlternates(await getLocale(), '/subscribe'),
    robots: { index: false, follow: false },
  };
}

export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<BillingSkeleton checkout />}>
      <SubscribePage {...props} />
    </Suspense>
  );
}
