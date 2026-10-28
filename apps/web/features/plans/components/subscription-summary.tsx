'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { useSubscription } from '../hooks/use-billing';
import { BillingSkeleton } from './billing-skeleton';
import { SubscriptionCard } from './subscription-card';
import { SubscriptionPeriod } from './subscription-period';

export function SubscriptionSummary({ cancelled }: { cancelled: boolean }) {
  return (
    <SessionUserBoundary
      render={(user) =>
        user?.id ? (
          <UserSubscriptionSummary userId={user.id} cancelled={cancelled} />
        ) : null
      }
    />
  );
}

function UserSubscriptionSummary({
  userId,
  cancelled,
}: {
  userId: string;
  cancelled: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('billing');
  const result = useSubscription(userId, locale);
  if (result.isPending) return <BillingSkeleton label={t('loading')} />;
  if (result.isError)
    return (
      <div role="alert" className="space-y-4 rounded-2xl bg-surface p-6">
        <p>{t('summaryError')}</p>
        <Button
          onClick={() => {
            void result.refetch();
          }}
        >
          {t('retry')}
        </Button>
      </div>
    );
  return (
    <div className="space-y-6">
      {cancelled ? (
        <p role="status" className="rounded-2xl bg-muted p-4 text-sm">
          {t('cancelled')}
        </p>
      ) : null}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-12">
        <SubscriptionCard subscription={result.data.subscription} />
        <SubscriptionPeriod subscription={result.data.subscription} />
      </div>
    </div>
  );
}
