import {
  type SubmitPracticeAttemptBody,
  submitPracticeAttemptBodySchema,
} from '@notefinder/contracts';

/** A visitor's run, waiting in the session for the sign-in to submit it. */
export type PendingAttempt = {
  trackId: string;
  body: SubmitPracticeAttemptBody;
};

const KEY_PREFIX = 'notefinder:pending-attempt:';

const keyOf = (trackId: string) => `${KEY_PREFIX}${trackId}`;

/** The session storage surface the waiting runs need. */
export type PendingAttemptStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'length' | 'key'
>;

const isPendingAttempt = (value: unknown): value is PendingAttempt => {
  if (typeof value !== 'object' || value === null) return false;
  if (!('trackId' in value) || typeof value.trackId !== 'string') return false;
  if (!('body' in value)) return false;
  return submitPracticeAttemptBodySchema.safeParse(value.body).success;
};

/**
 * The Track's run waiting in this session, or undefined when none was kept
 * (or what was kept is not a run anymore). The body is re-validated on the
 * way out, so an older page never submits a shape the API stopped taking.
 */
export function readPendingAttempt(
  storage: PendingAttemptStorage | undefined,
  trackId: string,
): PendingAttempt | undefined {
  try {
    const raw = storage?.getItem(keyOf(trackId));
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    return isPendingAttempt(parsed) && parsed.trackId === trackId
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every run waiting in this session, whatever Track it was sung on. A run
 * left on one Track is still submitted when the sign-in lands on another,
 * since the redirect does not always come back to the same Track.
 */
export function listPendingAttempts(
  storage: PendingAttemptStorage | undefined,
): PendingAttempt[] {
  const waiting: PendingAttempt[] = [];
  try {
    const length = storage?.length ?? 0;
    for (let index = 0; index < length; index += 1) {
      const key = storage?.key(index);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      const raw = storage?.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : undefined;
      if (isPendingAttempt(parsed)) waiting.push(parsed);
    }
  } catch {
    // Storage blocked: nothing can be listed.
  }
  return waiting;
}

/** Keeps the visitor's run for the sign-in to submit. */
export function writePendingAttempt(
  storage: PendingAttemptStorage | undefined,
  attempt: PendingAttempt,
): void {
  try {
    storage?.setItem(keyOf(attempt.trackId), JSON.stringify(attempt));
  } catch {
    // Storage full or blocked: the run just is not kept.
  }
}

/** Forgets the Track's waiting run, once it is submitted (or refused). */
export function clearPendingAttempt(
  storage: PendingAttemptStorage | undefined,
  trackId: string,
): void {
  try {
    storage?.removeItem(keyOf(trackId));
  } catch {
    // Storage blocked: nothing was kept anyway.
  }
}
