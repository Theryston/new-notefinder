'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import { loadAuthClient } from '../auth-client';
import { authRequest } from '../auth-error';
import {
  absoluteAppUrl,
  authHref,
  hrefToPath,
  redirectToFromSearch,
} from '../redirect-to';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
      />
    </svg>
  );
}

/**
 * "Continue with Google". New Google users come back to pick a username;
 * existing ones go straight to `redirectTo`, and failures come back to the
 * sign-up page with `?error=`.
 */
export function GoogleButton({ onError }: { onError: () => void }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  const continueWithGoogle = async () => {
    setPending(true);
    const { origin, search } = window.location;
    const redirectTo = redirectToFromSearch(search);
    const url = (path: string) => absoluteAppUrl(origin, locale, path);
    // Better Auth appends `error=<code>` to the error URL.
    const { error } = await authRequest(async () =>
      (await loadAuthClient()).signIn.social({
        provider: 'google',
        callbackURL: url(redirectTo),
        newUserCallbackURL: url(
          hrefToPath(authHref('/setup-username', redirectTo)),
        ),
        errorCallbackURL: url(hrefToPath(authHref('/sign-up', redirectTo))),
      }),
    );
    // On success the browser is already leaving for Google.
    if (error) {
      setPending(false);
      onError();
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
      onClick={continueWithGoogle}
    >
      {pending ? <Spinner aria-label={t('loading')} /> : <GoogleMark />}
      {t('signUp.google')}
    </Button>
  );
}
