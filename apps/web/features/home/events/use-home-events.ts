'use client';

import { useEffect, useRef } from 'react';
import { startHomeTracking } from './home-tracking';
import { HomeImpressionQueue } from './impression-queue';
import type { TrackedHomePage } from './tracked-rows';

/**
 * Reports the home's row impressions and card clicks. A row counts once per
 * page load, when it is at least half visible for at least one second, with
 * the items on screen and their positions; a click leaves asynchronously,
 * without delaying or blocking the link's navigation.
 */
export function useHomeEvents(pages: TrackedHomePage[]): void {
  const queueRef = useRef<HomeImpressionQueue | null>(null);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (queueRef.current === null) {
      queueRef.current = new HomeImpressionQueue();
    }
    return startHomeTracking(pages, queueRef.current, trackedRef.current);
  }, [pages]);
}
