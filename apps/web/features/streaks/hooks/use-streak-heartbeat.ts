'use client';

import type { StreakStatus } from '@notefinder/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { getClientEnv } from '@/lib/env/client';

import { heartbeatBeacon } from '../heartbeat-beacon';
import { type HeartbeatLoop, startHeartbeatLoop } from '../heartbeat-loop';
import { streakKeys } from '../query-keys';
import { browserTimeZone, sendHeartbeat } from '../streak-queries';

/**
 * Reports practice time while `playing`, writes each answer into the streak
 * status the ring shows, and calls `onCompleted` once on the heartbeat that
 * reached the daily target. The heartbeat is a mutation (its answer updates
 * the status query); the pending seconds leave through a beacon when the page
 * is hidden or closed, which a mutation cannot do. The timing is in
 * `heartbeat-loop.ts`.
 */
export function useStreakHeartbeat(
  playing: boolean,
  onCompleted: (status: StreakStatus) => void,
) {
  const queryClient = useQueryClient();
  const heartbeat = useMutation({
    mutationFn: sendHeartbeat,
    onSuccess: (result, body) => {
      queryClient.setQueryData(streakKeys.status(body.timeZone), result.status);
    },
  });
  const send = useRef(heartbeat.mutateAsync);
  send.current = heartbeat.mutateAsync;
  const completed = useRef(onCompleted);
  completed.current = onCompleted;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const loop = useRef<HeartbeatLoop | null>(null);

  useEffect(() => {
    const started = startHeartbeatLoop({
      now: () => performance.now(),
      timeZone: browserTimeZone,
      send: (body) => send.current(body),
      beacon: (body) => {
        const { url, data } = heartbeatBeacon(
          getClientEnv().NEXT_PUBLIC_API_URL,
          body,
        );
        navigator.sendBeacon(url, data);
      },
      onResult: (result) => {
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
  }, []);

  useEffect(() => {
    loop.current?.setPlaying(playing);
  }, [playing]);
}
