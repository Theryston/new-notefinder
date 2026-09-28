import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthFormSkeleton } from '@/features/auth/components/auth-form-skeleton';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { VerifyEmailStep } from '@/features/auth/components/verify-email-step';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.verifyEmail');

  return {
    title: t('metaTitle'),
    alternates: localeAlternates(await getLocale(), '/verify-email'),
    robots: { index: false },
  };
}

export default function VerifyEmailPage() {
  return (
    <AuthShell step="verifyEmail">
      <Suspense fallback={<AuthFormSkeleton fields={1} />}>
        <VerifyEmailStep />
      </Suspense>
    </AuthShell>
  );
}
