'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { RecordAcquisitionBody } from '@vozzify/contracts';
import { useEffect, useRef } from 'react';

import { sessionUserOptions } from '@/features/auth/session';
import { isApiError } from '@/lib/api/api-error';
import { getOrCreateVisitorId } from '@/lib/visitor-id';

import {
  captureCampaignTouch,
  clearCampaignTouches,
  readCampaignTouches,
} from '../campaign-touches';

const acquisitionRecordedKey = (userId: string) =>
  `vozzify:acquisition-recorded:${userId}`;

function markAcquisitionRecorded(userId: string): void {
  try {
    window.localStorage.setItem(acquisitionRecordedKey(userId), 'true');
  } catch {
    // Attribution must not block the signed-in page.
  }
}

/** Captures campaign arrivals and attaches them after either sign-up flow. */
export function AcquisitionAttributor() {
  const { data: user, isPending } = useQuery(sessionUserOptions());
  const sentForUser = useRef<string | null>(null);
  const { mutate } = useMutation({
    mutationFn: async (input: {
      userId: string;
      body: RecordAcquisitionBody;
    }) => {
      const [{ browserApi }, { acquisitionRecordedSchema }] = await Promise.all(
        [import('@/lib/api/browser'), import('@vozzify/contracts')],
      );
      return browserApi('/me/acquisition', {
        method: 'POST',
        body: input.body,
        schema: acquisitionRecordedSchema,
      });
    },
    onSuccess: (_response, { userId }) => {
      markAcquisitionRecorded(userId);
    },
    onError: (error, { userId }) => {
      if (isApiError(error) && error.code === 'CONFLICT') {
        // A conflict means the API already has this user's acquisition row.
        markAcquisitionRecorded(userId);
      }
    },
    onSettled: () => {
      try {
        clearCampaignTouches(window.localStorage);
      } catch {
        // Storage can be disabled independently of the rest of the page.
      }
    },
  });

  useEffect(() => {
    try {
      captureCampaignTouch(
        window.localStorage,
        window.location.href,
        document.referrer,
      );
    } catch {
      // Storage may be unavailable; sign-up and navigation must still work.
    }
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!user?.id) {
      sentForUser.current = null;
      return;
    }
    if (sentForUser.current === user.id) return;
    sentForUser.current = user.id;

    try {
      const storage = window.localStorage;
      if (storage.getItem(acquisitionRecordedKey(user.id)) === 'true') return;
      const touches = readCampaignTouches(storage);
      const visitorId = getOrCreateVisitorId(storage);
      mutate({ userId: user.id, body: { visitorId, ...touches } });
    } catch {
      // Storage may be unavailable; sign-up and navigation must still work.
    }
  }, [isPending, mutate, user?.id]);

  return null;
}
