'use client';

import { notFound } from 'next/navigation';
import { useEffect } from 'react';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { useRouter } from '@/lib/i18n/navigation';
import { BenefitsPanel } from './benefits-panel';
import { BenefitsSkeleton } from './benefits-skeleton';

export function AdminBenefits() {
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
  user: { role?: string } | null;
  loading: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!loading && user === null)
      router.replace({
        pathname: '/sign-in',
        query: { redirectTo: '/admin/benefits' },
      });
  }, [loading, user, router]);
  if (loading || user === null) return <BenefitsSkeleton />;
  if (user.role !== 'ADMIN') notFound();
  return <BenefitsPanel />;
}
