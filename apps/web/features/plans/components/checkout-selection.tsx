import type { Plan } from '@notefinder/contracts';
import { getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

export async function CheckoutSelection({ plan }: { plan: Plan }) {
  const t = await getTranslations('billing');
  if (plan.saleAvailable !== true) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {plan.offers.map((offer) => (
        <Link
          key={offer.id}
          className={buttonVariants({ variant: 'default' })}
          href={{
            pathname: '/subscribe',
            query: { plan: plan.id, cycle: offer.cycle, offer: offer.id },
          }}
        >
          {t(offer.cycle === 'annual' ? 'chooseAnnual' : 'chooseMonthly')}
        </Link>
      ))}
    </div>
  );
}
