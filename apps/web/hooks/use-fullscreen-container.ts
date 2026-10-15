'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (notify: () => void) => {
  document.addEventListener('fullscreenchange', notify);
  return () => document.removeEventListener('fullscreenchange', notify);
};

/** Portaled controls must stay inside the element on the fullscreen top layer. */
export function useFullscreenContainer() {
  return useSyncExternalStore(
    subscribe,
    () =>
      document.fullscreenElement instanceof HTMLElement
        ? document.fullscreenElement
        : null,
    () => null,
  );
}
