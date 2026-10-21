'use client';

import type {
  CreateEditorialPinBody,
  UpdateEditorialPinBody,
} from '@notefinder/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { isApiError } from '@/lib/api/api-error';

import { adminPinKeys } from '../admin-pins-query';

/**
 * Creates, changes and removes pins. The fetcher (and its contracts
 * schemas) loads on the first save, so Zod stays out of the page's
 * first-load JavaScript. A failure toasts the API error code translated;
 * the list refreshes after every change.
 */
export function useAdminPinMutations() {
  const queryClient = useQueryClient();
  const terror = useTranslations('errors');
  const fail = (error: unknown) => {
    toast.error(terror(isApiError(error) ? error.code : 'INTERNAL_ERROR'));
  };
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: adminPinKeys.all });
  };

  const createPin = useMutation({
    mutationFn: async (body: CreateEditorialPinBody) => {
      const { createAdminPin } = await import('../admin-pins-client');
      return createAdminPin(body);
    },
    onSuccess: settle,
    onError: (error: unknown) => fail(error),
  });

  const updatePin = useMutation({
    mutationFn: async ({
      pinId,
      body,
    }: {
      pinId: string;
      body: UpdateEditorialPinBody;
    }) => {
      const { updateAdminPin } = await import('../admin-pins-client');
      return updateAdminPin(pinId, body);
    },
    onSuccess: settle,
    onError: (error: unknown) => fail(error),
  });

  const deletePin = useMutation({
    mutationFn: async (pinId: string) => {
      const { deleteAdminPin } = await import('../admin-pins-client');
      return deleteAdminPin(pinId);
    },
    onSuccess: settle,
    onError: (error: unknown) => fail(error),
  });

  return { createPin, updatePin, deletePin };
}
