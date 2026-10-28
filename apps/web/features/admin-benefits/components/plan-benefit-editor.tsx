'use client';

import type { AdminBenefits, BenefitPlan } from '@notefinder/contracts';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { isLocale } from '@/lib/i18n/routing';
import type { useBenefitCatalog } from '../hooks/use-benefit-catalog';

type Props = {
  plan: BenefitPlan;
  benefits: AdminBenefits;
  link: ReturnType<typeof useBenefitCatalog>['link'];
};

export function PlanBenefitEditor({ plan, benefits, link }: Props) {
  const t = useTranslations('adminBenefits');
  const pageLocale = useLocale();
  const locale = isLocale(pageLocale) ? pageLocale : 'en';
  const [draft, setIds] = useState(plan.benefitIds);
  const ids = draft.filter((id) =>
    benefits.some((benefit) => benefit.id === id),
  );
  const move = (index: number, offset: number) => {
    const next = [...ids];
    const id = next[index];
    if (!id) return;
    next.splice(index, 1);
    next.splice(index + offset, 0, id);
    setIds(next);
  };
  const save = async () => {
    try {
      await link.mutateAsync({ planId: plan.id, benefitIds: ids });
    } catch {
      /* The mutation displays the translated error. */
    }
  };
  return (
    <section
      aria-label={plan.copy[locale].name}
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
    >
      <h3 className="font-bold text-lg">{plan.copy[locale].name}</h3>
      <BenefitChoices benefits={benefits} ids={ids} setIds={setIds} />
      <ol className="flex flex-col gap-2">
        {ids.map((id, index) => {
          const name = benefits.find((benefit) => benefit.id === id)?.copy[
            locale
          ].name;
          return (
            <li key={id} className="flex items-center justify-between gap-2">
              <span className="text-sm">{name}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  aria-label={t('moveUp', { name: name ?? '' })}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === ids.length - 1}
                  aria-label={t('moveDown', { name: name ?? '' })}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        variant="outline"
        disabled={link.isPending}
        onClick={() => void save()}
      >
        {t('saveLinks')}
      </Button>
    </section>
  );
}

function BenefitChoices({
  benefits,
  ids,
  setIds,
}: {
  benefits: AdminBenefits;
  ids: string[];
  setIds: (ids: string[]) => void;
}) {
  const pageLocale = useLocale();
  const locale = isLocale(pageLocale) ? pageLocale : 'en';
  return (
    <div className="flex flex-wrap gap-3">
      {benefits.map((benefit) => (
        <label
          key={benefit.id}
          className="flex min-h-10 items-center gap-2 text-sm"
        >
          <input
            type="checkbox"
            checked={ids.includes(benefit.id)}
            onChange={(event) =>
              setIds(
                event.target.checked
                  ? [...ids, benefit.id]
                  : ids.filter((id) => id !== benefit.id),
              )
            }
          />
          {benefit.copy[locale].name}
        </label>
      ))}
    </div>
  );
}
