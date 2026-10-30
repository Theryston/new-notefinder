'use client';

import type { Subscription } from '@vozzify/contracts';
import { ArrowRightIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { useChangeOptions } from '../hooks/use-change-options';

type ChangeState = ReturnType<typeof useChangeOptions>;

export function ChangeOffers({
  subscription,
  state,
}: {
  subscription: Subscription;
  state: ChangeState;
}) {
  const t = useTranslations('billing.change');
  if (state.catalog.isPending) return <p role="status">{t('loading')}</p>;
  if (state.catalog.isError) return null;
  if (!state.catalog.data?.length) return <p role="status">{t('empty')}</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {state.catalog.data.map((offer) => (
        <ChangeOffer
          key={offer.id}
          offer={offer}
          subscription={subscription}
          state={state}
        />
      ))}
    </div>
  );
}

function ChangeOffer({
  offer,
  subscription,
  state,
}: {
  offer: NonNullable<ChangeState['catalog']['data']>[number];
  subscription: Subscription;
  state: ChangeState;
}) {
  const t = useTranslations('billing.change');
  const billing = useTranslations('billing');
  const format = useFormatter();
  const effective = subscription.pendingChange ?? subscription;
  const current =
    offer.planId === effective.planId && offer.cycle === effective.cycle;
  const amount = format.number(offer.amount / 100, {
    style: 'currency',
    currency: subscription.currency,
  });
  return (
    <article
      aria-label={t('option', {
        plan: offer.name,
        cycle: t(offer.cycle),
        amount,
      })}
      className={cn(
        'flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-sm',
        state.selection === offer.id && 'ring-2 ring-primary',
      )}
    >
      <div className="space-y-1">
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {t(offer.cycle)}
        </p>
        <h3 className="font-bold text-2xl tracking-tight">{offer.name}</h3>
      </div>
      <div className="space-y-2">
        <p className="font-bold text-2xl tabular-nums tracking-tight">
          {amount}
        </p>
        <p className="text-muted-foreground text-sm">
          {billing(
            offer.cycle === 'annual' ? 'annualCharge' : 'monthlyCharge',
            { amount },
          )}
        </p>
      </div>
      <Button
        className="mt-auto w-full"
        variant="secondary"
        disabled={current || state.mutation.isPending}
        onClick={() => {
          state.setSelection(offer.id);
          state.setConfirming(true);
          state.mutation.reset();
        }}
      >
        {current
          ? t(subscription.pendingChange ? 'scheduledOffer' : 'activeOffer')
          : t('review')}
        {!current ? <ArrowRightIcon aria-hidden /> : null}
      </Button>
    </article>
  );
}
