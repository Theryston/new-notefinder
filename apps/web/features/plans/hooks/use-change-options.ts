'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Subscription } from '@vozzify/contracts';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { billingKeys } from '../query-keys';

export function useChangeOptions(subscription: Subscription, userId: string) {
  const locale = useLocale();
  const client = useQueryClient();
  const [selection, setSelection] = useState('');
  const [confirming, setConfirming] = useState(false);
  const currencyLocale = subscription.currency === 'BRL' ? 'pt-BR' : 'en';
  const catalog = useQuery({
    queryKey: billingKeys.changeOffers(currencyLocale, locale),
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
