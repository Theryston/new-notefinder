'use client';

import {
  type CreateTrackResult,
  createTrackResultSchema,
  type Locale,
} from '@notefinder/contracts';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { browserApi } from '@/lib/api/browser';
import { useRouter } from '@/lib/i18n/navigation';

import { requestErrorMessage } from '../request-error';
import {
  markRequested,
  tabRequestMarks,
  unmarkRequested,
} from '../request-once';

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
 * the API's error code (and, for a limit, by which limit it is).
 */
export function useRequestTrack() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  return useMutation({
    mutationFn: (recordingMbid: string) => {
      markRequested(tabRequestMarks(), recordingMbid);
      return requestTrack(recordingMbid, locale);
    },
    onSuccess: ({ trackId }) => {
      router.push(`/tracks/${trackId}`);
    },
    onError: (error: unknown, recordingMbid: string) => {
      // A request that failed created nothing, so it may be asked again.
      unmarkRequested(tabRequestMarks(), recordingMbid);
      const message = requestErrorMessage(error);
      toast.error(t(message.key, message.values));
    },
  });
}
