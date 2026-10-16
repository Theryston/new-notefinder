import {
  type PracticeAttempt,
  practiceAttemptSchema,
  type SubmitPracticeAttemptBody,
} from '@notefinder/contracts';

import { browserApi } from '@/lib/api/browser';

/**
 * Saves a signed-in User's valid run (`POST /v1/tracks/:trackId/attempts`).
 * Runs that covered under 90% of the notes or skipped forward are refused
 * by the API with `ATTEMPT_REJECTED`, so callers only send runs the scoring
 * judged submittable.
 */
export function submitPracticeAttempt(
  trackId: string,
  body: SubmitPracticeAttemptBody,
): Promise<PracticeAttempt> {
  return browserApi(`/tracks/${encodeURIComponent(trackId)}/attempts`, {
    method: 'POST',
    body,
    schema: practiceAttemptSchema,
  });
}
