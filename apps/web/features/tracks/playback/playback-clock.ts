import type { TimelineClock } from '@/features/timeline/components/note-timeline';

import { playbackStore } from '../stores/playback-store';

/** What the timeline follows: the playback store's time, read by subscription. */
export const playbackClock: TimelineClock = {
  now: () => playbackStore.getState().time,
  subscribe: (listener) => playbackStore.subscribe(listener),
};
