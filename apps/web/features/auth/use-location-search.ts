import { useSyncExternalStore } from 'react';

const noSubscription = () => () => {};

/**
 * The query string, read after hydration: auth pages are prerendered once for
 * every visitor, so query params (`redirectTo`, `error`, `email`) can't be
 * part of their HTML.
 */
export function useLocationSearch(): string {
  return useSyncExternalStore(
    noSubscription,
    () => window.location.search,
    () => '',
  );
}
