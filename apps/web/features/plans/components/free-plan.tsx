import type { Plan } from '@notefinder/contracts';
import { ArrowRightIcon, ChevronDownIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { BenefitList } from './plan-benefits';
import { PlanPracticePreview } from './plan-practice-preview';

export async function FreePlan({ plan }: { plan: Plan }) {
  const t = await getTranslations('plans');
  return (
    <article aria-label={plan.name} className="space-y-5">
      <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
        {t('includedIn', { plan: plan.name })}
      </h2>
      <PlanPracticePreview />
      <div className="flex flex-col items-start justify-between gap-4 border-border border-t pt-5 sm:flex-row sm:items-center">
        <p className="max-w-48 text-muted-foreground text-xs leading-relaxed">
          {t('freePrice')}
        </p>
        <Link
          href="/search"
          className={buttonVariants({ variant: 'secondary' })}
        >
          {t('startSinging')}
          <ArrowRightIcon aria-hidden />
        </Link>
      </div>
      {plan.benefits.length > 0 ? (
        <details className="border-border border-t pt-4">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 font-medium text-muted-foreground text-sm [&::-webkit-details-marker]:hidden">
            {t('includedBenefits')}
            <ChevronDownIcon aria-hidden className="size-4" />
          </summary>
          <div className="pt-3">
            <BenefitList benefits={plan.benefits} />
          </div>
        </details>
      ) : null}
    </article>
  );
}
