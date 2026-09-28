'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { usePathname, useRouter } from '@/lib/i18n/navigation';

import { requiredAuthStep } from '../auth-gate';
import { sessionUserOptions } from '../session';

/**
 * Sends signed-in users who haven't finished onboarding (unverified email,
 * no username) to that step, from any page. Runs in the browser after load,
 * so pages stay static and cacheable; signed-out visitors are left alone.
 */
export function AuthGate() {
  const { data: user } = useQuery(sessionUserOptions());
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const step = requiredAuthStep(user, pathname, window.location.search);
    if (step) router.replace(step);
  }, [user, pathname, router]);

  return null;
}
