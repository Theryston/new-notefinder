import { connection } from 'next/server';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { BillingGate } from '@/features/plans/components/billing-gate';
import { SubscriptionSummary } from '@/features/plans/components/subscription-summary';

export const instant = false;
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
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
