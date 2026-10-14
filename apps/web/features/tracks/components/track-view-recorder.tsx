'use client';

import { trackViewSchema } from '@notefinder/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { browserApi } from '@/lib/api/browser';
import { sessionUserOptions } from '@/lib/session';

const viewStorageKey = (trackId: string) => `notefinder:track-view:${trackId}`;

/** Records one view per browser tab session and later attributes it to a User. */
export function TrackViewRecorder({ trackId }: { trackId: string }) {
  const session = useQuery(sessionUserOptions());

  useEffect(() => {
    if (session.isPending) return;
    const key = viewStorageKey(trackId);
    const viewId = sessionStorage.getItem(key);
    const userEmail = session.data?.email;
    const attachedKey = userEmail ? `${key}:attached:${userEmail}` : null;
    if (
      viewId !== null &&
      (attachedKey === null || sessionStorage.getItem(attachedKey) !== null)
    ) {
      return;
    }

    void browserApi(`/tracks/${encodeURIComponent(trackId)}/views`, {
      method: 'POST',
      body: viewId === null ? undefined : { viewId },
      schema: trackViewSchema,
    })
      .then((result) => {
        sessionStorage.setItem(key, result.viewId);
        if (attachedKey !== null) sessionStorage.setItem(attachedKey, '1');
      })
      .catch(() => undefined);
  }, [session.data?.email, session.isPending, trackId]);

  return null;
}
