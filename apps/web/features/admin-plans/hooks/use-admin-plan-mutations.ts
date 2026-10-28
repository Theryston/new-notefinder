'use client';
import type { SaveAdminPlanBody } from '@notefinder/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminPlanKeys } from '../query-keys';

export function useSaveAdminPlan(options: {
  planId?: string;
  onSuccess: () => void;
}) {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: adminPlanKeys.catalog });
  return useMutation({
    mutationFn: async (body: SaveAdminPlanBody) =>
      (await import('../client')).saveAdminPlan(body, options.planId),
    onSuccess: async () => {
      await refresh();
      options.onSuccess();
    },
    onError: refresh,
  });
}

export function useContractingMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) =>
      (await import('../client')).setContracting(enabled),
    onSuccess: (catalog) => client.setQueryData(adminPlanKeys.catalog, catalog),
  });
}
