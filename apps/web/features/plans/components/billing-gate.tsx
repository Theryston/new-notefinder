'use client';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect } from 'react';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { useRouter } from '@/lib/i18n/navigation';
import { BillingSkeleton } from './billing-skeleton';

export function BillingGate({
  children,
  redirectTo,
}: {
  children: ReactNode;
  redirectTo: string;
}) {
  return (
    <SessionUserBoundary
      render={(user, loading) => (
        <Gate
          ready={Boolean(user?.emailVerified && user.username)}
          loading={loading}
          signedIn={Boolean(user)}
          redirectTo={redirectTo}
        >
          {children}
        </Gate>
      )}
    />
  );
}
function Gate({
  ready,
  loading,
  signedIn,
  redirectTo,
  children,
}: {
  ready: boolean;
  loading: boolean;
  signedIn: boolean;
  redirectTo: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations('billing');
  useEffect(() => {
    if (!loading && !signedIn)
      router.replace({ pathname: '/sign-in', query: { redirectTo } });
  }, [loading, signedIn, router, redirectTo]);
  if (!ready || loading) return <BillingSkeleton label={t('loading')} />;
  return children;
}
