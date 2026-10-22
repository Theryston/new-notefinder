'use client';

import { notFound } from 'next/navigation';
import { useEffect } from 'react';

import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { useRouter } from '@/lib/i18n/navigation';

import { AdminIndexCards } from './admin-index-cards';
import { AdminIndexSkeleton } from './admin-index-skeleton';

const ADMIN_PATH = '/admin';

/**
 * The admin index gate: anonymous visitors go to sign in and come back, a
 * signed-in user without the admin role gets the app's not-found page, and
 * only an admin sees the section cards.
 */
export function AdminIndex() {
  return (
    <SessionUserBoundary
      render={(user, loading) => <AdminGate user={user} loading={loading} />}
    />
  );
}

function AdminGate({
  user,
  loading,
}: {
  /** The signed-in user, as far as the gate cares: only the role matters. */
  user: { role?: string } | null;
  loading: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!loading && user === null) {
      router.replace({
        pathname: '/sign-in',
        query: { redirectTo: ADMIN_PATH },
      });
    }
  }, [loading, user, router]);

  if (loading || user === null) return <AdminIndexSkeleton />;
  if (user.role !== 'ADMIN') notFound();
  return <AdminIndexCards />;
}
