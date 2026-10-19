'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

const readTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The viewer's time zone, or `undefined` while the page is server-rendered and
 * hydrating: the server cannot know it, so the first render must not show
 * times or days that the browser would then change.
 */
export function useBrowserTimeZone(): string | undefined {
  return useSyncExternalStore(subscribe, readTimeZone, () => undefined);
}
