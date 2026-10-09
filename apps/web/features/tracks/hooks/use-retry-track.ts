'use client';

import { trackProcessingStateSchema } from '@notefinder/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { browserApi } from '@/lib/api/browser';
import { trackKeys } from '../query-keys';
import { requestErrorMessage } from '../request-error';
import { isRetryConflict } from '../retry-offer';

/** Starts a new Processing of a failed Track (`POST .../processing/retry`). */
function retryTrack(trackId: string, locale: string) {
  return browserApi(`/tracks/${encodeURIComponent(trackId)}/processing/retry`, {
    method: 'POST',
    body: { locale },
    schema: trackProcessingStateSchema,
  });
}

/**
 * Asks the API to retry the Track's failed Processing. The state it answers
 * goes straight into the page's query, so the page shows the new Processing and
 * polling resumes. A refusal is a translated toast, by the API's error code.
 */
export function useRetryTrack(trackId: string) {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useTranslations();
  return useMutation({
    mutationFn: () => retryTrack(trackId, locale),
    onSuccess: (state) => {
      queryClient.setQueryData(trackKeys.processing(trackId), state);
    },
    onError: async (error: unknown) => {
      if (isRetryConflict(error)) {
        // Someone else retried first: read the Track again to show their Processing.
        toast.error(t('tracks.processing.retry.conflict'));
        await queryClient.invalidateQueries({
          queryKey: trackKeys.processing(trackId),
        });
        return;
      }
      const message = requestErrorMessage(error);
      toast.error(t(message.key, message.values));
    },
  });
}
