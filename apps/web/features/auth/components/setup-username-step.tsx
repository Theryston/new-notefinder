'use client';

import { useQuery } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import { useEffect, useRef } from 'react';

import { useRouter } from '@/lib/i18n/navigation';

import { authHref, safeRedirectPath } from '../redirect-to';
import { sessionUserOptions } from '../session';
import { AuthFormSkeleton } from './auth-form-skeleton';
import { SignedInAs } from './sign-out';
import { UsernameForm } from './username-form';

/**
 * Only for signed-in users without a username: the session is read in the
 * browser (the page itself stays static), and everyone else is sent on.
 */
export function SetupUsernameStep() {
  const [redirectParam] = useQueryState('redirectTo');
  const redirectTo = safeRedirectPath(redirectParam);
  const router = useRouter();
  const { data: user, isPending } = useQuery(sessionUserOptions());

  // Signing out from this page empties the session too; that navigation is
  // the sign-out's, so only a visit without a session goes to sign in.
  const hadSession = useRef(false);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      if (!hadSession.current) router.replace(authHref('/sign-in', redirectTo));
      return;
    }
    hadSession.current = true;
    // An unverified email goes to its own step first (see AuthGate).
    if (user.username && user.emailVerified) router.replace(redirectTo);
  }, [isPending, user, redirectTo, router]);

  if (isPending || !user || user.username)
    return <AuthFormSkeleton fields={1} />;
  return (
    <div className="flex flex-col gap-8">
      <UsernameForm name={user.name} redirectTo={redirectTo} />
      <SignedInAs email={user.email} />
    </div>
  );
}
