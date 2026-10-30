'use client';

import type { Subscription } from '@vozzify/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChangeOptions } from '../hooks/use-change-options';
import { ChangeOffers } from './change-offers';

export function SubscriptionChange({
  subscription,
  userId,
}: {
  subscription: Subscription;
  userId: string;
}) {
  const t = useTranslations('billing.change');
  const [open, setOpen] = useState(false);
  const eligible =
    subscription.paidMembership &&
    !subscription.cancelAtPeriodEnd &&
    Boolean(subscription.currentPeriodEnd);
  return (
    <div className="space-y-3">
      {!open ? <PendingChange subscription={subscription} /> : null}
      {eligible ? (
        <>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t('title')}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent closeLabel={t('close')} className="max-w-3xl gap-6">
              <DialogHeader>
                <DialogTitle>{t('title')}</DialogTitle>
                <DialogDescription>{t('select')}</DialogDescription>
              </DialogHeader>
              <ChangeContent subscription={subscription} userId={userId} />
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

function ChangeContent({
  subscription,
  userId,
}: {
  subscription: Subscription;
  userId: string;
}) {
  const t = useTranslations('billing.change');
  const state = useChangeOptions(subscription, userId);
  return (
    <div className="space-y-5">
      <ChangeOffers subscription={subscription} state={state} />
      <ChangeError show={state.catalog.isError} message={t('loadError')} />
      {state.confirming ? (
        <ChangeConfirmation
          subscription={subscription}
          offer={state.offer}
          confirming={state.confirming}
          setConfirming={state.setConfirming}
          mutation={state.mutation}
        />
      ) : null}
      <ChangeError show={state.mutation.isError} message={t('error')} />
      <PendingChange subscription={subscription} />
    </div>
  );
}

function PendingChange({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('billing.change');
  const format = useFormatter();
  const change = subscription.pendingChange;
  if (!change) return null;
  return (
    <p role="status">
      {t('pending', {
        plan: change.planName,
        cycle: t(change.cycle),
        amount: format.number(change.amount / 100, {
          style: 'currency',
          currency: change.currency,
        }),
        date: format.dateTime(new Date(change.effectiveAt), {
          dateStyle: 'medium',
        }),
      })}
    </p>
  );
}

function ChangeError({ show, message }: { show: boolean; message: string }) {
  return show ? <p role="alert">{message}</p> : null;
}

function ChangeConfirmation({
  subscription,
  offer,
  confirming,
  setConfirming,
  mutation,
}: {
  subscription: Subscription;
  offer: ReturnType<typeof useChangeOptions>['offer'];
  confirming: boolean;
  setConfirming: (value: boolean) => void;
  mutation: ReturnType<typeof useChangeOptions>['mutation'];
}) {
  const t = useTranslations('billing.change');
  const format = useFormatter();
  if (!offer || !confirming || !subscription.currentPeriodEnd)
    return (
      <Button
        disabled={!offer || mutation.isPending}
        onClick={() => setConfirming(true)}
      >
        {t('review')}
      </Button>
    );
  const restoring =
    Boolean(subscription.pendingChange) &&
    offer.planId === subscription.planId &&
    offer.cycle === subscription.cycle;
  return (
    <div className="space-y-3">
      <p>
        {t(restoring ? 'restoreConfirmation' : 'confirmation', {
          plan: offer.name,
          cycle: t(offer.cycle),
          amount: format.number(offer.amount / 100, {
            style: 'currency',
            currency: subscription.currency,
          }),
          date: format.dateTime(new Date(subscription.currentPeriodEnd), {
            dateStyle: 'medium',
          }),
        })}
      </p>
      <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {t(restoring ? 'restoreConfirm' : 'confirm')}
      </Button>
    </div>
  );
}
