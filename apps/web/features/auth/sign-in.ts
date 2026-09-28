import type { SignInBody } from '@notefinder/contracts';

import type { AuthErrorCode } from './auth-error';
import type { SessionUser } from './session';

/** What the Better Auth client is called with for a sign-in attempt. */
export type SignInCredentials =
  | { method: 'email'; email: string; password: string }
  | { method: 'username'; username: string; password: string };

/**
 * Like legacy, one field takes the email or the username. Usernames can't
 * contain `@`, so anything with one is an email (a malformed one gets the
 * API's `INVALID_EMAIL`).
 */
export function signInCredentials({
  emailOrUsername,
  password,
}: SignInBody): SignInCredentials {
  const identifier = emailOrUsername.trim();
  return identifier.includes('@')
    ? { method: 'email', email: identifier, password }
    : { method: 'username', username: identifier, password };
}

/**
 * The email to verify when sign-in was refused because it isn't verified
 * yet (the API has just sent it a code), or `null` when the form should
 * show the error instead: always, unless the user typed that email.
 */
export function emailToVerify(
  error: AuthErrorCode,
  credentials: SignInCredentials,
): string | null {
  if (error !== 'EMAIL_NOT_VERIFIED' || credentials.method !== 'email') {
    return null;
  }
  return credentials.email;
}

/**
 * A visitor who is already signed in and done with onboarding has nothing
 * to do on the sign-in page (the gate handles the unfinished ones).
 */
export function isSignedInAndOnboarded(
  user: SessionUser | null | undefined,
): boolean {
  return Boolean(user?.emailVerified && user.username);
}
