/** How long the user waits before asking for another code. */
const RESEND_COOLDOWN_SECONDS = 60;

/** Whole seconds left before a new code can be requested (0 when allowed). */
export function cooldownSecondsLeft(
  sentAt: number,
  now: number,
  cooldownSeconds = RESEND_COOLDOWN_SECONDS,
): number {
  const left = Math.ceil((sentAt + cooldownSeconds * 1000 - now) / 1000);
  return Math.max(0, left);
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** What an emailed code is for (Better Auth's OTP `type`). */
export type CodePurpose = 'email-verification' | 'forget-password';

// Each purpose has its own code, so its own cooldown. Verification codes
// keep the original key, so countdowns already stored still apply.
const storageKey = (email: string, purpose: CodePurpose) => {
  const scope = purpose === 'email-verification' ? '' : `${purpose}:`;
  return `notefinder:otp-sent-at:${scope}${email.trim().toLowerCase()}`;
};

/**
 * `localStorage`, or `undefined` where it can't be used (server, private
 * mode, blocked site data): the cooldown then just starts over.
 */
export function browserStorage(): KeyValueStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * When the last `purpose` code for `email` was sent in this browser, so reloading the
 * page doesn't reset the resend cooldown. `null` when unknown.
 */
export function readCodeSentAt(
  storage: KeyValueStorage | undefined,
  email: string,
  purpose: CodePurpose = 'email-verification',
): number | null {
  try {
    const value = Number(storage?.getItem(storageKey(email, purpose)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function rememberCodeSentAt(
  storage: KeyValueStorage | undefined,
  email: string,
  sentAt: number,
  purpose: CodePurpose = 'email-verification',
): void {
  try {
    storage?.setItem(storageKey(email, purpose), String(sentAt));
  } catch {
    // Full or blocked storage: the cooldown only lasts for this page view.
  }
}
