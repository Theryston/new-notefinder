'use client';

import { useQuery } from '@tanstack/react-query';
import { billingKeys } from '../query-keys';

export function useTrialEligibility(
  userId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: billingKeys.trialEligibility(userId),
    enabled,
    queryFn: async () => {
      const [{ browserApi }, { trialEligibilitySchema }] = await Promise.all([
        import('@/lib/api/browser'),
        import('@vozzify/contracts'),
      ]);
      return browserApi('/me/subscription/trial-eligibility', {
        schema: trialEligibilitySchema,
      });
    },
  });
}
