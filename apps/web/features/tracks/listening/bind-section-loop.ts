import type { StoreApi } from 'zustand';

import type { PlaybackController } from '../playback/playback-controller';
import type { PlaybackState } from '../stores/playback-store';
import { type LoopRange, loopRange } from './listening-math';

type LoopStore = StoreApi<{ range: LoopRange | null }>;

/** Normalize before seeking: a player can replace an overestimated duration. */
export function bindSectionLoop({
  playback,
  loop,
  controller,
}: {
  playback: StoreApi<PlaybackState>;
  loop: LoopStore;
  controller: Pick<PlaybackController, 'seek' | 'play'>;
}) {
  let rewinding = false;
  return playback.subscribe(({ time, status, duration }) => {
    const { range } = loop.getState();
    if (!range || rewinding) return;
    const normalized = loopRange(range.start, range.end, duration);
    if (
      !normalized ||
      normalized.start !== range.start ||
      normalized.end !== range.end
    ) {
      loop.setState({ range: normalized });
    }
    if (
      !normalized ||
      (status !== 'ended' && (status !== 'playing' || time < normalized.end))
    )
      return;
    rewinding = true;
    try {
      controller.seek(normalized.start);
      if (status === 'ended') controller.play();
    } finally {
      rewinding = false;
    }
  });
}
