'use client';

import { useEffect } from 'react';

import type { PlaybackController } from '../playback/playback-controller';
import { playbackStore } from '../stores/playback-store';
import { bindSectionLoop } from './bind-section-loop';
import { useLoop } from './loop-store';

export function useListeningTools(controller: PlaybackController | null) {
  useEffect(() => {
    useLoop.setState({ range: null });
    if (!controller) return;
    const unsubscribe = bindSectionLoop({
      playback: playbackStore,
      loop: useLoop,
      controller,
    });
    return () => {
      unsubscribe();
      useLoop.setState({ range: null });
    };
  }, [controller]);
}
