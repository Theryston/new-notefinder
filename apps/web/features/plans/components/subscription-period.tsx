'use client';

import type { Subscription } from '@vozzify/contracts';
import { ArrowRightIcon, CheckIcon, Clock3Icon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { subscriptionState } from '../subscription-presentation';
import { PortalButton } from './portal-button';

export function SubscriptionPeriod({
  subscription,
}: {
  subscription: Subscription | null;
}) {
  const t = useTranslations('billing');
  const state = subscriptionState(subscription);
  const recoveryState = subscription?.recoveryDeadline
    ? subscription.paidMembership
      ? 'overdue'
      : 'suspended'
    : null;
  return (
    <section className="min-w-0 space-y-4 pt-1">
      {subscription?.providerStatus === 'trialing' ? (
        <p className="font-semibold">{t('trialStatus')}</p>
      ) : null}
      <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
        {t(`subscription.${subscription ? 'currentPeriod' : 'overview'}`)}
      </p>
      <h2 className="max-w-96 font-bold text-2xl tracking-tight md:text-3xl">
        {t(`subscription.titles.${recoveryState ?? state}`)}
      </h2>
      {!recoveryState ? (
        <PeriodDescription state={state} subscription={subscription} />
      ) : null}
      {subscription ? <RecoveryNotice subscription={subscription} /> : null}
      {subscription ? <PeriodTimeline subscription={subscription} /> : null}
      {subscription?.providerStatus ? (
        <PortalButton recovery={Boolean(subscription.recoveryDeadline)} />
      ) : null}
      <Link
        href="/plans"
        className="inline-flex min-h-10 items-center gap-2 rounded-full font-semibold text-primary text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
      >
        {t('viewPlans')}
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
    </section>
  );
}

function PeriodDescription({
  state,
  subscription,
}: {
  state: ReturnType<typeof subscriptionState>;
  subscription: Subscription | null;
}) {
  const t = useTranslations('billing');
  const description =
    subscription?.providerStatus === 'trialing'
      ? t(
          subscription.cancelAtPeriodEnd
            ? 'trialEndingDescription'
            : 'trialDescription',
        )
      : t(descriptionKey(state));
  return (
    <p role="status" className="max-w-prose text-muted-foreground text-sm">
      {description}
    </p>
  );
}

function RecoveryNotice({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('billing');
  const format = useFormatter();
  if (!subscription.recoveryDeadline) return null;
  const date = format.dateTime(new Date(subscription.recoveryDeadline), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <p
      role="alert"
      className="rounded-xl bg-warning/10 p-4 text-foreground text-sm"
    >
      {subscription.paidMembership
        ? t('recoveryGrace', { date })
        : t('recoverySuspended')}
    </p>
  );
}

function PeriodTimeline({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('billing.subscription');
  const format = useFormatter();
  const state = subscriptionState(subscription);
  if (subscription.recoveryDeadline)
    return <RecoveryTimeline subscription={subscription} />;
  const paid = state === 'active' || state === 'ending' || state === 'ended';
  const date = (value: string | null) =>
    value
      ? format.dateTime(new Date(value), { dateStyle: 'medium' })
      : t('dateUnavailable');
  return (
    <>
      <ol className="pt-4">
        <PeriodEvent
          label={t('periodStart')}
          value={date(subscription.currentPeriodStart)}
          done={paid}
        />
        <PeriodEvent
          label={
            subscription.providerStatus === 'trialing'
              ? t('trialLabel')
              : t(
                  `payment.${paid ? 'confirmed' : state === 'pending' ? 'pending' : 'unsuccessful'}`,
                )
          }
          value={t(`states.${state}`)}
          done={paid}
        />
        <PeriodEvent
          label={t(
            state === 'active'
              ? 'nextCharge'
              : state === 'ended'
                ? 'periodEnded'
                : 'periodEnd',
          )}
          value={date(subscription.currentPeriodEnd)}
        />
      </ol>
      <BillingDetails subscription={subscription} />
    </>
  );
}

function RecoveryTimeline({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('billing.subscription');
  const format = useFormatter();
  const date = (value: string | null) =>
    value
      ? format.dateTime(new Date(value), { dateStyle: 'medium' })
      : t('dateUnavailable');
  return (
    <>
      <ol className="pt-4">
        <PeriodEvent
          label={t('periodStart')}
          value={date(subscription.currentPeriodStart)}
        />
        <PeriodEvent
          label={t('payment.overdue')}
          value={t(
            `states.${subscription.paidMembership ? 'overdue' : 'suspended'}`,
          )}
        />
        <PeriodEvent
          label={t('recoveryDeadline')}
          value={date(subscription.recoveryDeadline ?? null)}
        />
      </ol>
      <BillingDetails subscription={subscription} />
    </>
  );
}

function BillingDetails({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('billing.subscription');
  return (
    <dl className="flex flex-wrap gap-x-9 gap-y-4 border-border border-t pt-5 text-xs">
      <div className="space-y-1">
        <dt className="text-muted-foreground">{t('billingCycle')}</dt>
        <dd className="font-semibold">{t(subscription.cycle)}</dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground">{t('contractCurrency')}</dt>
        <dd className="font-semibold">{subscription.currency}</dd>
      </div>
    </dl>
  );
}

function PeriodEvent({
  label,
  value,
  done = false,
}: {
  label: string;
  value: string;
  done?: boolean;
}) {
  const Icon = done ? CheckIcon : Clock3Icon;
  return (
    <li className="relative flex min-h-20 gap-4 pb-6 not-last:before:absolute not-last:before:top-7 not-last:before:bottom-0 not-last:before:left-3.5 not-last:before:w-px not-last:before:bg-border">
      <span
        className={cn(
          'relative grid size-7 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground',
          done && 'border-transparent bg-success/10 text-success',
        )}
      >
        <Icon aria-hidden className="size-3.5" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-muted-foreground text-sm tabular-nums">{value}</p>
      </div>
    </li>
  );
}

function descriptionKey(state: ReturnType<typeof subscriptionState>) {
  if (state === 'free') return 'noSubscription';
  if (state === 'ended') return 'subscription.endedDescription';
  if (state === 'ending') return 'subscription.endingDescription';
  return state === 'active' ? 'confirmed' : state;
}
