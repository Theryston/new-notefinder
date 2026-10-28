'use client';
import { useQuery } from '@tanstack/react-query';
import { adminPlanKeys } from '../query-keys';

export function useAdminPlans() {
  return useQuery({
    queryKey: adminPlanKeys.catalog,
    queryFn: async ({ signal }) =>
      (await import('../client')).fetchAdminPlans(signal),
  });
}
