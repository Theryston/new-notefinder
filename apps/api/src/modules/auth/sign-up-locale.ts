import type { Locale } from '@notefinder/contracts';
import { resolveEmailLocale } from '../../integrations/email/email-locale.js';

/** The request a Better Auth hook runs for, when there is one. */
type HookRequestContext = {
  headers?: Headers;
  request?: { headers: Headers };
} | null;

/**
 * The language a new account starts in: the language the sign-up request
 * asks for (`Accept-Language`), in the same supported set as the emails. Sign-up
 * requests from the web always carry it; a request without one is English.
 */
export const signUpLocale = (context: HookRequestContext): Locale =>
  resolveEmailLocale(
    (context?.headers ?? context?.request?.headers)?.get('accept-language'),
  );
