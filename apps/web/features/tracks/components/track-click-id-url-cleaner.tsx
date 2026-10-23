'use client';

import { useEffect } from 'react';
import { consumeClickId } from '@/lib/home-click-id';

/** Removes attribution query data even when a Track route resolves to 404. */
export function TrackClickIdUrlCleaner() {
  useEffect(() => {
    const { clickId, cleanHref } = consumeClickId(window.location.href);
    if (clickId !== undefined) {
      window.history.replaceState(window.history.state, '', cleanHref);
    }
  }, []);

  return null;
}
