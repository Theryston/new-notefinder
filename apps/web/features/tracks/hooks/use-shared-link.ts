'use client';

import { parseAsBoolean, parseAsFloat, useQueryState } from 'nuqs';
import { type RefObject, useEffect, useRef } from 'react';

import type { PlaybackController } from '../playback/playback-controller';
import { canSeekToSharedMoment, sharedMomentOf } from '../shared-moment';
import { usePlaybackState } from '../stores/playback-store';

/**
 * Honors `?time=<seconds>` of an old shared link: once the player has loaded,
 * playback is positioned there, once. It never starts the music, since
 * browsers refuse sound nobody asked for.
 */
export function useSharedMoment(controller: PlaybackController | null) {
  const [time] = useQueryState('time', parseAsFloat);
  const status = usePlaybackState((state) => state.status);
  const applied = useRef(false);
  const moment = sharedMomentOf(time);

  useEffect(() => {
    if (applied.current || !controller || moment === null) return;
    if (!canSeekToSharedMoment(status)) return;
    applied.current = true;
    controller.seek(moment);
  }, [controller, moment, status]);
}

/**
 * Honors `?timeline-focus=true` of an old shared link: once the timeline is on
 * screen (`ready`), the page scrolls to it, once.
 */
export function useTimelineFocus(
  timelineRef: RefObject<HTMLElement | null>,
  ready: boolean,
) {
  const [focus] = useQueryState('timeline-focus', parseAsBoolean);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || focus !== true || !ready) return;
    done.current = true;
    timelineRef.current?.scrollIntoView({ block: 'start' });
  }, [focus, ready, timelineRef]);
}
