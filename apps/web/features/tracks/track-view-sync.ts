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
  clickId?: string,
): Promise<void> {
  while (pending.has(trackId)) await pending.get(trackId);
  const storage = sessionStorageOrUndefined();
  const stored = readStoredView(storage, trackId);
  const action = nextViewAction(stored, signedIn);
  if (action === 'none' && clickId === undefined) return;
  // Only a new view takes the locale: an attached one keeps the locale it has.
  const request = postViewForAction({
    trackId,
    action,
    storedViewId: stored?.viewId,
    locale,
    clickId,
  }).then((viewId) => {
    writeStoredView(storage, trackId, { viewId, attached: signedIn });
  });
  pending.set(trackId, request);
  try {
    await request;
  } finally {
    pending.delete(trackId);
  }
}

const postViewForAction = (options: {
  trackId: string;
  action: 'record' | 'attach' | 'none';
  storedViewId: string | undefined;
  locale?: Locale;
  clickId: string | undefined;
}): Promise<string> => {
  const { trackId, action, storedViewId, locale, clickId } = options;
  if (action === 'record') {
    return clickId === undefined
      ? postTrackView(trackId, undefined, locale)
      : postTrackView(trackId, undefined, locale, clickId);
  }
  return clickId === undefined
    ? postTrackView(trackId, storedViewId)
    : postTrackView(trackId, storedViewId, undefined, clickId);
};
