'use client';

import type { StreakStatus } from '@notefinder/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { getClientEnv } from '@/lib/env/client';

import { heartbeatBeacon } from '../heartbeat-beacon';
import { type HeartbeatLoop, startHeartbeatLoop } from '../heartbeat-loop';
import { streakKeys } from '../query-keys';
import { browserTimeZone, sendHeartbeat } from '../streak-queries';

/**
 * Reports practice time while `playing`, writes each answer into the streak
 * status the ring shows, and calls `onCompleted` once on the heartbeat that
 * reached the daily target. The pending seconds leave through a beacon when
 * the page is hidden or closed. The logic is in `heartbeat-loop.ts`.
 */
export function useStreakHeartbeat(
  playing: boolean,
  onCompleted: (status: StreakStatus) => void,
) {
  const queryClient = useQueryClient();
  const loop = useRef<HeartbeatLoop | null>(null);
  const completed = useRef(onCompleted);
  completed.current = onCompleted;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const started = startHeartbeatLoop({
      now: () => performance.now(),
      timeZone: browserTimeZone,
      send: sendHeartbeat,
      beacon: (body) => {
        const { url, data } = heartbeatBeacon(
          getClientEnv().NEXT_PUBLIC_API_URL,
          body,
        );
        navigator.sendBeacon(url, data);
      },
      onResult: (result) => {
        queryClient.setQueryData(streakKeys.status(), result.status);
        if (result.justCompleted) completed.current(result.status);
      },
    });
    started.setPlaying(playingRef.current);
    loop.current = started;

    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') started.flushWithBeacon();
    };
    const flush = () => started.flushWithBeacon();
    document.addEventListener('visibilitychange', flushWhenHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('pagehide', flush);
      // Leaving the practice page (not the browser) keeps what was played.
      started.flushWithBeacon();
      started.stop();
      loop.current = null;
    };
  }, [queryClient]);

  useEffect(() => {
    loop.current?.setPlaying(playing);
  }, [playing]);
}
