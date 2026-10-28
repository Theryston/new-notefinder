'use client';
import { notFound } from 'next/navigation';
import { useEffect } from 'react';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { useRouter } from '@/lib/i18n/navigation';
import { AdminPlansSkeleton } from './admin-plans-skeleton';
import { PlansPanel } from './plans-panel';

export function AdminPlans() {
  return (
    <SessionUserBoundary
      render={(user, loading) => <Gate user={user} loading={loading} />}
    />
  );
}
function Gate({
  user,
  loading,
}: {
  user: { role?: string } | null;
  loading: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user)
      router.replace({
        pathname: '/sign-in',
        query: { redirectTo: '/admin/plans' },
      });
  }, [loading, user, router]);
  if (loading || !user) return <AdminPlansSkeleton />;
  if (user.role !== 'ADMIN') notFound();
  return <PlansPanel />;
}
