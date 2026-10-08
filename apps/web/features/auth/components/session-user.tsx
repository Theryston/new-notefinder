'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { type SessionUser, sessionUserOptions } from '../session';

/**
 * Renders with the signed-in user, or `null` while the session is loading or
 * when nobody is signed in. Lets another feature offer signed-in actions
 * without importing the session query, which belongs to the auth feature.
 */
export function SessionUserBoundary({
  render,
}: {
  render: (user: SessionUser | null) => ReactNode;
}) {
  const session = useQuery(sessionUserOptions());
  return render(session.data ?? null);
}
