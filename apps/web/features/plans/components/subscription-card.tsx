'use client';

import type { Subscription } from '@vozzify/contracts';
import { ArrowRightIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { subscriptionState } from '../subscription-presentation';
import { SubscriptionStatus } from './subscription-status';

export function SubscriptionCard({
  subscription,
}: {
  subscription: Subscription | null;
}) {
  const t = useTranslations('billing.subscription');
  const state = subscriptionState(subscription);
  return (
    <section
      aria-label={t('planSummary')}
      className="relative flex min-h-104 flex-col justify-between gap-8 overflow-hidden rounded-2xl bg-surface p-6 shadow-sm md:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-16 -right-32 size-56 rounded-full border-32 border-foreground/3"
      />
      <div className="relative space-y-5">
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {t('currentPlan')}
        </p>
        <h2 className="break-words font-extrabold text-6xl tracking-tighter">
          {subscription?.planName ?? t('freePlan')}
        </h2>
        <SubscriptionStatus subscription={subscription} />
      </div>
      <div className="relative border-border border-t pt-6">
        {subscription ? (
          <SubscriptionPrice subscription={subscription} />
        ) : (
          <p className="text-muted-foreground text-sm">{t('freeCaption')}</p>
        )}
      </div>
      {state === 'active' || state === 'ending' ? (
        <Link
          href="/search"
          className={buttonVariants({ className: 'relative w-full' })}
        >
          {t('findSong')}
          <ArrowRightIcon aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

function SubscriptionPrice({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('billing');
  const format = useFormatter();
  const amount = format.number(subscription.amount / 100, {
    style: 'currency',
    currency: subscription.currency,
  });
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-baseline gap-x-2 font-extrabold text-3xl tabular-nums tracking-tight">
        <span>{amount}</span>
        <span className="font-normal text-muted-foreground text-sm tracking-normal">
          {t(`subscription.${subscription.cycle}Unit`)}
        </span>
      </p>
      <p className="text-muted-foreground text-xs">
        {t(subscription.cycle === 'annual' ? 'annualCharge' : 'monthlyCharge', {
          amount,
        })}
      </p>
    </div>
  );
}
