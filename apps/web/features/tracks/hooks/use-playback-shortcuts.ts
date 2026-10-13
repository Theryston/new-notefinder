'use client';

import { useEffect } from 'react';

import type { PlaybackController } from '../playback/playback-controller';
import { shortcutOfKeyboard } from '../playback/shortcuts';

/** Space plays and pauses, the arrows skip 5 s, anywhere on the page. */
export function usePlaybackShortcuts(controller: PlaybackController | null) {
  useEffect(() => {
    if (!controller) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcutOfKeyboard({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        target: event.target instanceof HTMLElement ? event.target : null,
      });
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut.type === 'toggle') controller.toggle();
      else controller.skip(shortcut.seconds);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [controller]);
}
