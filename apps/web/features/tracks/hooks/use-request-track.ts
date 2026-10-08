'use client';

import {
  type CreateTrackResult,
  createTrackResultSchema,
  type Locale,
} from '@notefinder/contracts';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { isApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser';
import { useRouter } from '@/lib/i18n/navigation';

/** Asks the API for a Recording to become a Track (`POST /v1/tracks`). */
function requestTrack(
  recordingMbid: string,
  locale: Locale,
): Promise<CreateTrackResult> {
  return browserApi('/tracks', {
    method: 'POST',
    body: { recordingMbid, locale },
    schema: createTrackResultSchema,
  });
}

/**
 * Requests the Track of a Recording and, once it exists (new or already there),
 * takes the User to its Processing page. A failure is a translated toast, by
 * the API's error code.
 */
export function useRequestTrack() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  return useMutation({
    mutationFn: (recordingMbid: string) => requestTrack(recordingMbid, locale),
    onSuccess: ({ trackId }) => {
      router.push(`/tracks/${trackId}`);
    },
    onError: (error: unknown) => {
      const code = isApiError(error) ? error.code : 'INTERNAL_ERROR';
      toast.error(t(`errors.${code}`));
    },
  });
}
