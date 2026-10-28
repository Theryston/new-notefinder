'use client';

import { useQuery } from '@tanstack/react-query';
import type { AdminBenefit } from '@vozzify/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isLocale } from '@/lib/i18n/routing';
import type { useBenefitCatalog } from '../hooks/use-benefit-catalog';
import { benefitKeys } from '../query-keys';

type Props = {
  benefit: AdminBenefit;
  remove: ReturnType<typeof useBenefitCatalog>['remove'];
  close: () => void;
};

export function DeleteBenefitDialog({ benefit, remove, close }: Props) {
  const t = useTranslations('adminBenefits');
  const pageLocale = useLocale();
  const locale = isLocale(pageLocale) ? pageLocale : 'en';
  const current = useQuery({
    queryKey: benefitKeys.deletionImpact(benefit.id),
    retry: false,
    queryFn: async () =>
      (await import('../benefits-client')).fetchBenefit(benefit.id),
  });
  const confirm = async () => {
    try {
      await remove.mutateAsync(benefit.id);
      close();
    } catch {
      /* The mutation displays the translated error. */
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent closeLabel={t('cancel')}>
        <DialogHeader>
          <DialogTitle>
            {t('deleteTitle', { name: benefit.copy[locale].name })}
          </DialogTitle>
          <DialogDescription>{t('deleteDescription')}</DialogDescription>
        </DialogHeader>
        {current.isPending ? (
          <p role="status">{t('loading')}</p>
        ) : current.isError ? (
          <p role="alert">{t('loadError')}</p>
        ) : (
          <>
            <p className="font-semibold">{t('usedBy')}</p>
            <ul>
              {current.data.plans.map((plan) => (
                <li key={plan.id}>{plan.copy[locale].name}</li>
              ))}
            </ul>
            {current.data.plans.length === 0 && <p>{t('unused')}</p>}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={
              !current.isSuccess || current.isFetching || remove.isPending
            }
            onClick={() => void confirm()}
          >
            {t('confirmDelete')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
