'use client';

import { useQuery } from '@tanstack/react-query';
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
  const sent = useRef(false);

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
    if (isPending || !user || sent.current) return;
    sent.current = true;

    void (async () => {
      try {
        const storage = window.localStorage;
        const touches = readCampaignTouches(storage);
        const visitorId = getOrCreateVisitorId(storage);
        const [{ browserApi }, { acquisitionRecordedSchema }] =
          await Promise.all([
            import('@/lib/api/browser'),
            import('@notefinder/contracts'),
          ]);
        await browserApi('/me/acquisition', {
          method: 'POST',
          body: { visitorId, ...touches },
          schema: acquisitionRecordedSchema,
        });
      } catch {
        // Attribution is best effort and must never block the signed-in page.
      } finally {
        try {
          clearCampaignTouches(window.localStorage);
        } catch {
          // Storage can be disabled independently of the rest of the page.
        }
      }
    })();
  }, [isPending, user]);

  return null;
}
