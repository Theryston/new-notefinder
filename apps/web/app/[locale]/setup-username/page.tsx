import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthFormSkeleton } from '@/features/auth/components/auth-form-skeleton';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { SetupUsernameStep } from '@/features/auth/components/setup-username-step';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.setupUsername');

  return {
    title: t('metaTitle'),
    alternates: localeAlternates(await getLocale(), '/setup-username'),
    robots: { index: false },
  };
}

export default function SetupUsernamePage() {
  return (
    <AuthShell step="setupUsername">
      <Suspense fallback={<AuthFormSkeleton fields={1} />}>
        <SetupUsernameStep />
      </Suspense>
    </AuthShell>
  );
}
