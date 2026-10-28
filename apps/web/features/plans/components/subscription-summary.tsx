'use client';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { Link } from '@/lib/i18n/navigation';
import { useSubscription } from '../hooks/use-billing';
import { BillingSkeleton } from './billing-skeleton';

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
  const format = useFormatter();
  const result = useSubscription(userId, locale);
  if (result.isPending) return <BillingSkeleton label={t('loading')} />;
  if (result.isError)
    return (
      <div role="alert">
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
  const subscription = result.data.subscription;
  return (
    <section className="max-w-xl space-y-6 rounded-2xl bg-card p-6 shadow-sm">
      <h1 className="font-bold text-3xl tracking-tight">{t('summaryTitle')}</h1>
      {cancelled ? <p role="status">{t('cancelled')}</p> : null}
      {subscription ? (
        <>
          <h2 className="font-semibold text-xl">{subscription.planName}</h2>
          <p role="status">{t(subscription.status)}</p>
          <p>
            {t(
              subscription.cycle === 'annual'
                ? 'annualCharge'
                : 'monthlyCharge',
              {
                amount: format.number(subscription.amount / 100, {
                  style: 'currency',
                  currency: subscription.currency,
                }),
              },
            )}
          </p>
          <p>{t('contractCurrency', { currency: subscription.currency })}</p>
          {subscription.currentPeriodStart ? (
            <p>
              {t('periodStart', {
                date: format.dateTime(
                  new Date(subscription.currentPeriodStart),
                  { dateStyle: 'medium' },
                ),
              })}
            </p>
          ) : null}
          {subscription.currentPeriodEnd ? (
            <p>
              {t('periodEnd', {
                date: format.dateTime(new Date(subscription.currentPeriodEnd), {
                  dateStyle: 'medium',
                }),
              })}
            </p>
          ) : null}
        </>
      ) : (
        <p>{t('noSubscription')}</p>
      )}
      <Link
        href="/plans"
        className="inline-flex min-h-10 items-center underline"
      >
        {t('viewPlans')}
      </Link>
    </section>
  );
}
