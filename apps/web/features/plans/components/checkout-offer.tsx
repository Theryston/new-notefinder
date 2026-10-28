'use client';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { CheckoutConfirmation } from './checkout-confirmation';

export function CheckoutOffer({
  planId,
  offerId,
  cycle,
}: {
  planId: string;
  offerId: string;
  cycle: string;
}) {
  const locale = useLocale();
  const t = useTranslations('billing');
  // Checkout reads fresh offers; the comparison's shared cache is presentation only.
  const result = useQuery({
    queryKey: ['billing', 'offer', locale, planId, offerId],
    queryFn: async () => {
      const [{ browserApi }, { planCatalogSchema }] = await Promise.all([
        import('@/lib/api/browser'),
        import('@notefinder/contracts'),
      ]);
      return browserApi('/plans', {
        schema: planCatalogSchema,
        query: { locale },
      });
    },
    staleTime: 0,
  });
  if (result.isPending) return <p role="status">{t('loading')}</p>;
  const catalog = result.data;
  const plan = catalog?.plans.find((item) => item.id === planId);
  const offer = plan?.offers.find(
    (item) => item.id === offerId && item.cycle === cycle,
  );
  if (!catalog || !plan || !offer || plan.saleAvailable !== true)
    return (
      <div role="alert" className="space-y-4">
        <p>{t('unavailable')}</p>
        <Link href="/plans" className="underline">
          {t('viewPlans')}
        </Link>
      </div>
    );
  return (
    <CheckoutConfirmation
      plan={plan}
      offer={offer}
      currency={catalog.currency}
    />
  );
}
