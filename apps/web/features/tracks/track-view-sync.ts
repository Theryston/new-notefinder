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
): Promise<void> {
  while (pending.has(trackId)) await pending.get(trackId);
  const storage = sessionStorageOrUndefined();
  const stored = readStoredView(storage, trackId);
  const action = nextViewAction(stored, signedIn);
  if (action === 'none') return;
  const request = postTrackView(
    trackId,
    action === 'attach' ? stored?.viewId : undefined,
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
