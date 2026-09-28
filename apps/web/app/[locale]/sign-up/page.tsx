import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { AuthShell } from '@/features/auth/components/auth-shell';
import { SignUpForm } from '@/features/auth/components/sign-up-form';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.signUp');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localeAlternates(await getLocale(), '/sign-up'),
  };
}

export default function SignUpPage() {
  return (
    <AuthShell step="signUp">
      <SignUpForm />
    </AuthShell>
  );
}
