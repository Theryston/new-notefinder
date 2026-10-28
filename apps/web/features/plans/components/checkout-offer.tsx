'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { useCheckoutOffer } from '../hooks/use-billing';
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
  const result = useCheckoutOffer({ locale, planId, offerId });
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
