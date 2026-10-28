'use client';

import type { WriteBenefitBody } from '@notefinder/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { isApiError } from '@/lib/api/api-error';

const key = ['admin-benefits'] as const;

export function useBenefitCatalog() {
  const client = useQueryClient();
  const t = useTranslations('errors');
  const benefits = useQuery({
    queryKey: [...key, 'catalog'],
    retry: false,
    queryFn: async ({ signal }) =>
      (await import('../benefits-client')).fetchBenefits(signal),
  });
  const plans = useQuery({
    queryKey: [...key, 'plans'],
    retry: false,
    queryFn: async ({ signal }) =>
      (await import('../benefits-client')).fetchBenefitPlans(signal),
  });
  const onSuccess = () => client.invalidateQueries({ queryKey: key });
  const onError = (error: unknown) =>
    toast.error(t(isApiError(error) ? error.code : 'INTERNAL_ERROR'));
  const save = useMutation({
    mutationFn: async ({ body, id }: { body: WriteBenefitBody; id?: string }) =>
      (await import('../benefits-client')).saveBenefit(body, id),
    onSuccess,
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) =>
      (await import('../benefits-client')).deleteBenefit(id),
    onSuccess,
    onError,
  });
  const link = useMutation({
    mutationFn: async ({
      planId,
      benefitIds,
    }: {
      planId: string;
      benefitIds: string[];
    }) =>
      (await import('../benefits-client')).savePlanBenefits(planId, benefitIds),
    onSuccess,
    onError,
  });
  return { benefits, plans, save, remove, link };
}
