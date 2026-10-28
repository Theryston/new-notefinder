import type { Locale } from '@vozzify/contracts';

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
  attribution?: { clickId?: string; visitorId?: string },
): Promise<void> {
  while (pending.has(trackId)) await pending.get(trackId);
  const storage = sessionStorageOrUndefined();
  const stored = readStoredView(storage, trackId);
  const { clickId, visitorId } = attribution ?? {};
  const action = nextViewAction(stored, signedIn, clickId);
  if (action === 'none' && clickId === undefined) return;
  // Only a new view takes the locale: an attached one keeps the locale it has.
  const request = postViewForAction({
    trackId,
    action,
    storedViewId: stored?.viewId,
    locale,
    clickId,
    visitorId,
  }).then((viewId) => {
    writeStoredView(storage, trackId, {
      viewId,
      attached: signedIn,
      ...(clickId === undefined ? {} : { clickId }),
    });
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
  visitorId: string | undefined;
}): Promise<string> => {
  const { trackId, action, storedViewId, locale, clickId, visitorId } = options;
  const attribution = {
    ...(clickId === undefined ? {} : { clickId }),
    ...(visitorId === undefined ? {} : { visitorId }),
  };
  if (action === 'record') {
    return Object.keys(attribution).length === 0
      ? postTrackView(trackId, undefined, locale)
      : postTrackView(trackId, undefined, locale, attribution);
  }
  return Object.keys(attribution).length === 0
    ? postTrackView(trackId, storedViewId)
    : postTrackView(trackId, storedViewId, undefined, attribution);
};
