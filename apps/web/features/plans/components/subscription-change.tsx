'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Subscription } from '@vozzify/contracts';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { billingKeys } from '../query-keys';

export function SubscriptionChange({
  subscription,
  userId,
}: {
  subscription: Subscription;
  userId: string;
}) {
  const t = useTranslations('billing.change');
  const {
    catalog,
    selection,
    setSelection,
    confirming,
    setConfirming,
    offer,
    mutation,
  } = useChangeOptions(subscription, userId);
  return (
    <section
      className="space-y-4 rounded-2xl bg-surface p-6"
      aria-label={t('title')}
    >
      <h2 className="font-bold text-xl">{t('title')}</h2>
      <PendingChange subscription={subscription} />
      {subscription.paidMembership &&
      !subscription.cancelAtPeriodEnd &&
      subscription.currentPeriodEnd ? (
        <>
          <label htmlFor="subscription-change" className="block text-sm">
            {t('select')}
          </label>
          <select
            id="subscription-change"
            className="w-full rounded-lg border border-border bg-background p-3"
            value={selection}
            onChange={(event) => {
              setSelection(event.target.value);
              setConfirming(false);
            }}
          >
            <option value="">{t('placeholder')}</option>
            {catalog.data?.map((item) => (
              <OfferOption
                key={item.id}
                item={item}
                currency={subscription.currency}
              />
            ))}
          </select>
          <ChangeError show={catalog.isError} message={t('loadError')} />
          <ChangeConfirmation
            subscription={subscription}
            offer={offer}
            confirming={confirming}
            setConfirming={setConfirming}
            mutation={mutation}
          />
          <ChangeError show={mutation.isError} message={t('error')} />
        </>
      ) : null}
    </section>
  );
}

function useChangeOptions(subscription: Subscription, userId: string) {
  const locale = useLocale();
  const client = useQueryClient();
  const [selection, setSelection] = useState('');
  const [confirming, setConfirming] = useState(false);
  const currencyLocale = subscription.currency === 'BRL' ? 'pt-BR' : 'en';
  const catalog = useQuery({
    queryKey: ['change-offers', currencyLocale, locale],
    queryFn: () => fetchChangeOffers(currencyLocale, locale),
  });
  const offer = catalog.data?.find((item) => item.id === selection);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!offer) throw new Error('Offer is unavailable');
      const [{ browserApi }, { currentSubscriptionSchema }] = await Promise.all(
        [import('@/lib/api/browser'), import('@vozzify/contracts')],
      );
      return browserApi('/me/subscription/change', {
        method: 'POST',
        schema: currentSubscriptionSchema,
        query: { locale },
        body: { planId: offer.planId, offerId: offer.id, cycle: offer.cycle },
      });
    },
    onSuccess: async () => {
      setConfirming(false);
      await client.invalidateQueries({
        queryKey: billingKeys.subscription(userId, locale),
      });
    },
  });
  return {
    catalog,
    selection,
    setSelection,
    confirming,
    setConfirming,
    offer,
    mutation,
  };
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

function OfferOption({
  item,
  currency,
}: {
  item: {
    id: string;
    name: string;
    cycle: 'monthly' | 'annual';
    amount: number;
  };
  currency: Subscription['currency'];
}) {
  const t = useTranslations('billing.change');
  const format = useFormatter();
  return (
    <option value={item.id}>
      {t('option', {
        plan: item.name,
        cycle: t(item.cycle),
        amount: format.number(item.amount / 100, {
          style: 'currency',
          currency,
        }),
      })}
    </option>
  );
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
  return (
    <div className="space-y-3">
      <p>
        {t('confirmation', {
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
        {t('confirm')}
      </Button>
    </div>
  );
}

async function fetchChangeOffers(currencyLocale: string, locale: string) {
  const [{ browserApi }, { planCatalogSchema }] = await Promise.all([
    import('@/lib/api/browser'),
    import('@vozzify/contracts'),
  ]);
  const [prices, names] = await Promise.all([
    browserApi('/plans', {
      schema: planCatalogSchema,
      query: { locale: currencyLocale },
    }),
    browserApi('/plans', { schema: planCatalogSchema, query: { locale } }),
  ]);
  return prices.plans.flatMap((plan) =>
    plan.kind === 'paid' && plan.saleAvailable
      ? plan.offers.map((offer) => ({
          ...offer,
          planId: plan.id,
          name: names.plans.find((p) => p.id === plan.id)?.name ?? plan.name,
        }))
      : [],
  );
}
