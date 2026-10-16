import {
  type SubmitPracticeAttemptBody,
  submitPracticeAttemptBodySchema,
} from '@notefinder/contracts';

/** A visitor's run, waiting in the session for the sign-in to submit it. */
export type PendingAttempt = {
  trackId: string;
  body: SubmitPracticeAttemptBody;
};

const keyOf = (trackId: string) => `notefinder:pending-attempt:${trackId}`;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

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
  storage: ReadableStorage | undefined,
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

/** Keeps the visitor's run for the sign-in to submit. */
export function writePendingAttempt(
  storage: WritableStorage | undefined,
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
  storage: WritableStorage | undefined,
  trackId: string,
): void {
  try {
    storage?.removeItem(keyOf(trackId));
  } catch {
    // Storage blocked: nothing was kept anyway.
  }
}
