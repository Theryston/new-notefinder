import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { BillingGate } from '@/features/plans/components/billing-gate';
import { BillingSkeleton } from '@/features/plans/components/billing-skeleton';
import { SubscriptionSummary } from '@/features/plans/components/subscription-summary';
import { localeAlternates } from '@/lib/i18n/metadata';

async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { billing } = await getMessages();
  return (
    <NextIntlClientProvider messages={{ billing }}>
      <BillingGate redirectTo="/subscription">
        <SubscriptionSummary cancelled={params.result === 'cancelled'} />
      </BillingGate>
    </NextIntlClientProvider>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('billing');
  return {
    title: t('summaryTitle'),
    alternates: localeAlternates(await getLocale(), '/subscription'),
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations('billing');
  return (
    <Suspense fallback={<BillingSkeleton label={t('loading')} />}>
      <SubscriptionPage {...props} />
    </Suspense>
  );
}
