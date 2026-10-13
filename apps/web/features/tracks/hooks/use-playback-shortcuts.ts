'use client';

import { useEffect } from 'react';

import type { PlaybackController } from '../playback/playback-controller';
import { handleShortcutKey } from '../playback/shortcut-handler';

/** Space plays and pauses, the arrows skip 5 s, anywhere on the page. */
export function usePlaybackShortcuts(controller: PlaybackController | null) {
  useEffect(() => {
    if (!controller) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const handled = handleShortcutKey(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          target: event.target instanceof HTMLElement ? event.target : null,
        },
        controller,
      );
      if (handled) event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [controller]);
}
