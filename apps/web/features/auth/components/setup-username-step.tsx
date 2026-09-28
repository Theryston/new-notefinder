'use client';

import { useQuery } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import { useEffect } from 'react';

import { useRouter } from '@/lib/i18n/navigation';

import { authHref, safeRedirectPath } from '../redirect-to';
import { sessionUserOptions } from '../session';
import { AuthFormSkeleton } from './auth-form-skeleton';
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

  useEffect(() => {
    if (isPending) return;
    if (!user) router.replace(authHref('/sign-in', redirectTo));
    else if (user.username) router.replace(redirectTo);
  }, [isPending, user, redirectTo, router]);

  if (isPending || !user || user.username)
    return <AuthFormSkeleton fields={1} />;
  return <UsernameForm name={user.name} redirectTo={redirectTo} />;
}
