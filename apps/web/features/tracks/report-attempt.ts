import type { SubmitPracticeAttemptBody } from '@notefinder/contracts';

import { writePendingAttempt } from './pending-attempt';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

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
  storage: (ReadableStorage & WritableStorage) | undefined;
}): void {
  if (signedIn) {
    submit(body);
  } else {
    writePendingAttempt(storage, { trackId, body });
  }
}
