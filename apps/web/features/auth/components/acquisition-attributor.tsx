'use client';

import type { RecordAcquisitionBody } from '@notefinder/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { sessionUserOptions } from '@/features/auth/session';
import { getOrCreateVisitorId } from '@/lib/visitor-id';

import {
  captureCampaignTouch,
  clearCampaignTouches,
  readCampaignTouches,
} from '../campaign-touches';

/** Captures campaign arrivals and attaches them after either sign-up flow. */
export function AcquisitionAttributor() {
  const { data: user, isPending } = useQuery(sessionUserOptions());
  const sentForUser = useRef<string | null>(null);
  const { mutate } = useMutation({
    mutationFn: async (body: RecordAcquisitionBody) => {
      const [{ browserApi }, { acquisitionRecordedSchema }] = await Promise.all(
        [import('@/lib/api/browser'), import('@notefinder/contracts')],
      );
      return browserApi('/me/acquisition', {
        method: 'POST',
        body,
        schema: acquisitionRecordedSchema,
      });
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
      const touches = readCampaignTouches(storage);
      const visitorId = getOrCreateVisitorId(storage);
      mutate({ visitorId, ...touches });
    } catch {
      // Storage may be unavailable; sign-up and navigation must still work.
    }
  }, [isPending, mutate, user?.id]);

  return null;
}
