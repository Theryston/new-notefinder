'use client';

import { useEffect } from 'react';

import type { PlaybackController } from '../playback/playback-controller';
import { playbackStore } from '../stores/playback-store';
import { useLoop } from './loop-store';

export function useListeningTools(controller: PlaybackController | null) {
  useEffect(() => {
    useLoop.setState({ range: null });
    if (!controller) return;
    const unsubscribe = playbackStore.subscribe(({ time, status }) => {
      const { range } = useLoop.getState();
      if (!range) return;
      if (status === 'ended') {
        controller.seek(range.start);
        controller.play();
      } else if (status === 'playing' && time >= range.end) {
        controller.seek(range.start);
      }
    });
    return () => {
      unsubscribe();
      useLoop.setState({ range: null });
    };
  }, [controller]);
}
