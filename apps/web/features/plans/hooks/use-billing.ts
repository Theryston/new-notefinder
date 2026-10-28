'use client';
import { useQuery } from '@tanstack/react-query';
import { billingKeys } from '../query-keys';

export function useCheckoutOffer(input: {
  locale: string;
  planId: string;
  offerId: string;
}) {
  return useQuery({
    queryKey: billingKeys.offer(input.locale, input.planId, input.offerId),
    queryFn: async () => {
      const [{ browserApi }, { planCatalogSchema }] = await Promise.all([
        import('@/lib/api/browser'),
        import('@notefinder/contracts'),
      ]);
      return browserApi('/plans', {
        schema: planCatalogSchema,
        query: { locale: input.locale },
      });
    },
    staleTime: 0,
  });
}
export function useSubscription(userId: string, locale: string) {
  return useQuery({
    queryKey: billingKeys.subscription(userId, locale),
    queryFn: async () => {
      const [{ browserApi }, { currentSubscriptionSchema }] = await Promise.all(
        [import('@/lib/api/browser'), import('@notefinder/contracts')],
      );
      return browserApi('/me/subscription', {
        schema: currentSubscriptionSchema,
        query: { locale },
      });
    },
    refetchInterval: (query) =>
      query.state.data?.subscription?.status === 'pending' ? 5000 : false,
  });
}
