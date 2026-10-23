import type { SubmitPracticeAttemptBody } from '@notefinder/contracts';

import {
  type PendingAttemptStorage,
  writePendingAttempt,
} from './pending-attempt';
import { readStoredView } from './track-view-session';

/**
 * Routes a finished run: a signed-in User's is submitted at once through
 * `submit`, and a visitor's waits in the session for the sign-in to submit
 * it. Kept out of the timeline so the rule stays testable without rendering.
 */
export function reportAttempt({
  signedIn,
  trackId,
  body,
  submit,
  storage,
}: {
  signedIn: boolean;
  trackId: string;
  body: SubmitPracticeAttemptBody;
  submit: (body: SubmitPracticeAttemptBody) => void;
  storage: PendingAttemptStorage | undefined;
}): void {
  const viewId = readStoredView(storage, trackId)?.viewId;
  const attributed =
    body.viewId !== undefined || viewId === undefined
      ? body
      : { ...body, viewId };
  if (signedIn) {
    submit(attributed);
  } else {
    writePendingAttempt(storage, { trackId, body: attributed });
  }
}
