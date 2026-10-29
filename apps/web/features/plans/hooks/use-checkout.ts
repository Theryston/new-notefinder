'use client';

import { useMutation } from '@tanstack/react-query';
import type { CreateCheckoutBody, Plan } from '@vozzify/contracts';
import { useLocale } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';

export function useCheckout(planId: string) {
  const locale = useLocale();
  const router = useRouter();
  return useMutation({
    mutationFn: async ({
      offer,
      trialDays,
    }: {
      offer: Plan['offers'][number];
      trialDays: number;
    }) => {
      const [{ browserApi }, { checkoutResultSchema }] = await Promise.all([
        import('@/lib/api/browser'),
        import('@vozzify/contracts'),
      ]);
      const body: CreateCheckoutBody = {
        planId,
        offerId: offer.id,
        cycle: offer.cycle,
        locale,
        comingSoonAcknowledged: true,
        ...(trialDays > 0 ? { trialDays } : {}),
      };
      return browserApi('/me/subscription/checkout', {
        schema: checkoutResultSchema,
        method: 'POST',
        body,
      });
    },
    onSuccess: (result) => {
      if (result.action === 'manage') router.push('/subscription');
      else window.location.assign(result.url);
    },
  });
}
