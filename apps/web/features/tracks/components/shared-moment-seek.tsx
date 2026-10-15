'use client';

import { useSharedMoment } from '../hooks/use-shared-link';
import type { PlaybackController } from '../playback/playback-controller';

/**
 * Applies `?time=` of an old shared link. It renders nothing and is its own
 * component so that the player's status, which it follows, re-renders only
 * this leaf and never the practice view around it.
 */
export function SharedMomentSeek({
  controller,
}: {
  controller: PlaybackController | null;
}) {
  useSharedMoment(controller);
  return null;
}
