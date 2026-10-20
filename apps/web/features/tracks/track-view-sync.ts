import type { Locale } from '@notefinder/contracts';

import { postTrackView } from './track-view-query';
import {
  nextViewAction,
  readStoredView,
  sessionStorageOrUndefined,
  writeStoredView,
} from './track-view-session';

// Keep ownership outside React so a route remount joins the same request.
const pending = new Map<string, Promise<void>>();

export async function synchronizeTrackView(
  trackId: string,
  signedIn: boolean,
  locale?: Locale,
): Promise<void> {
  while (pending.has(trackId)) await pending.get(trackId);
  const storage = sessionStorageOrUndefined();
  const stored = readStoredView(storage, trackId);
  const action = nextViewAction(stored, signedIn);
  if (action === 'none') return;
  // Only a new view takes the locale: an attached one keeps the locale it has.
  const request = (
    action === 'attach'
      ? postTrackView(trackId, stored?.viewId)
      : postTrackView(trackId, undefined, locale)
  ).then((viewId) => {
    writeStoredView(storage, trackId, { viewId, attached: signedIn });
  });
  pending.set(trackId, request);
  try {
    await request;
  } finally {
    pending.delete(trackId);
  }
}
