import {
  type AuthHref,
  authHref,
  redirectToFromSearch,
  safeRedirectPath,
} from './redirect-to';
import type { SessionUser } from './session';

// Pages that already carry the user's destination in `redirectTo`.
const AUTH_PAGES = new Set([
  '/sign-up',
  '/sign-in',
  '/verify-email',
  '/setup-username',
]);

/**
 * Where a signed-in user who hasn't finished onboarding must go before using
 * the app: verify the email first, then pick a username. `null` when signed
 * out, done, or already on that step. `pathname` has no locale prefix.
 */
export function requiredAuthStep(
  user: SessionUser | null | undefined,
  pathname: string,
  search: string,
): AuthHref | null {
  if (!user) return null;

  const redirectTo = AUTH_PAGES.has(pathname)
    ? redirectToFromSearch(search)
    : safeRedirectPath(`${pathname}${search}`);

  if (!user.emailVerified) {
    return pathname === '/verify-email'
      ? null
      : authHref('/verify-email', redirectTo, { email: user.email });
  }
  if (!user.username) {
    return pathname === '/setup-username'
      ? null
      : authHref('/setup-username', redirectTo);
  }
  return null;
}
