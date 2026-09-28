import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { AuthShell } from '@/features/auth/components/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.forgotPassword');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localeAlternates(await getLocale(), '/forgot-password'),
  };
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell step="forgotPassword">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
