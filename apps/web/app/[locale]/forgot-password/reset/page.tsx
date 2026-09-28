import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthFormSkeleton } from '@/features/auth/components/auth-form-skeleton';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { ResetPasswordStep } from '@/features/auth/components/reset-password-step';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.forgotPassword.reset');

  return {
    title: t('metaTitle'),
    alternates: localeAlternates(await getLocale(), '/forgot-password/reset'),
    robots: { index: false },
  };
}

export default function ResetPasswordPage() {
  return (
    <AuthShell step="resetPassword">
      <Suspense fallback={<AuthFormSkeleton fields={2} />}>
        <ResetPasswordStep />
      </Suspense>
    </AuthShell>
  );
}
