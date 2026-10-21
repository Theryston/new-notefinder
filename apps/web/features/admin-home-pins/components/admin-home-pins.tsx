'use client';

import { notFound } from 'next/navigation';
import { useEffect } from 'react';

import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { useRouter } from '@/lib/i18n/navigation';

import type { PinFormCatalog } from '../pin-form';
import { AdminHomePinsSkeleton } from './admin-home-pins-skeleton';
import { PinsPanel } from './pins-panel';

const ADMIN_PINS_PATH = '/admin/home-pins';

/**
 * The panel's gate: anonymous visitors go to sign in and come back, a
 * signed-in user without the admin role gets the app's not-found page, and
 * only an admin reaches the pins. The data calls are admin-only on the API
 * too, so a refused caller never sees a pin.
 */
export function AdminHomePins({ catalog }: { catalog: PinFormCatalog }) {
  return (
    <SessionUserBoundary
      render={(user, loading) => (
        <AdminGate user={user} loading={loading} catalog={catalog} />
      )}
    />
  );
}

function AdminGate({
  user,
  loading,
  catalog,
}: {
  /** The signed-in user, as far as the gate cares: only the role matters. */
  user: { role?: string } | null;
  loading: boolean;
  catalog: PinFormCatalog;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!loading && user === null) {
      router.replace({
        pathname: '/sign-in',
        query: { redirectTo: ADMIN_PINS_PATH },
      });
    }
  }, [loading, user, router]);

  if (loading || user === null) return <AdminHomePinsSkeleton />;
  if (user.role !== 'ADMIN') notFound();
  return <PinsPanel catalog={catalog} />;
}
